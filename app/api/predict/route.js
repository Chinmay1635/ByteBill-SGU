// app/api/predict/route.js

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();
const bigquery = new BigQuery({
  projectId: 'hopes-455920',
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS),
});

const datasetId = 'expense_data';
const tableId   = 'expenses';

async function uploadToBigQuery(prismaUserId) {
  console.log('🔄 [upload] Start for Prisma user.id:', prismaUserId);

  // 1️⃣ Find last date in BigQuery
  const [maxRows] = await bigquery.query({
    query: `
      SELECT MAX(date) AS lastDate
      FROM \`${datasetId}.${tableId}\`
      WHERE userId = @userId
    `,
    params: { userId: prismaUserId },
    location: 'US',
  });
  const lastDate = maxRows[0]?.lastDate;
  console.log('🔍 [upload] lastDate in BigQuery:', lastDate);

  // 2️⃣ Fetch only newer Prisma transactions
  const filter = {
    userId: prismaUserId,
    // ...(lastDate && { date: { gt: new Date(lastDate) } }),
  };
  
  if (lastDate && !isNaN(new Date(lastDate))) {
    filter.date = { gt: new Date(lastDate) };
  }
  const expenses = await prisma.transaction.findMany({ where: filter });
  console.log(`📦 [upload] Found ${expenses.length} new transactions`);

  if (!expenses.length) return;

  // 3️⃣ Prepare BigQuery rows
  const rows = expenses.map(e => ({
    type:        e.type.toString(),
    amount:      parseFloat(e.amount),
    category:    e.category,
    date:        e.date.toISOString().split('T')[0],
    description: e.description || '',
    userId:      e.userId,
  }));

  // 4️⃣ Insert into BigQuery
  try {
    await bigquery.dataset(datasetId).table(tableId).insert(rows);
    console.log(`✅ [upload] Inserted ${rows.length} rows`);
  } catch (err) {
    console.warn('⚠️ [upload] Insert error:', err.errors || err.message);
  }
}

async function predictPerCategoryPerUser(prismaUserId) {
  console.log('🔄 [predict] Aggregating expenses…');
  await bigquery.query(`
    CREATE OR REPLACE TABLE \`${datasetId}.user_monthly_category_expenses\` AS
    SELECT
      userId,
      category,
      EXTRACT(YEAR FROM DATE(date))*12 + EXTRACT(MONTH FROM DATE(date)) AS month_index,
      SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END) AS monthly_expense
    FROM \`${datasetId}.${tableId}\`
    GROUP BY userId, category, month_index;
  `);

  console.log('🔄 [predict] Training model…');
  try {
    await bigquery.query(`
      CREATE OR REPLACE MODEL \`${datasetId}.category_predictor\`
      OPTIONS(
        model_type='linear_reg',
        input_label_cols=['monthly_expense']
      ) AS
      SELECT userId, category, month_index, monthly_expense
      FROM \`${datasetId}.user_monthly_category_expenses\`;
    `);
    console.log('✅ [predict] Model trained.');
  } catch (err) {
    const msg = err.message || '';
    if (
      msg.includes('Model can not be updated by multiple create model query jobs') ||
      err.code === 400
    ) {
      console.warn('⚠️ [predict] Model training skipped due to conflict.');
    } else {
      throw err;
    }
  }

  // dynamically compute next month index
  const now = new Date();
  const nextMonthIndex = now.getFullYear() * 12 + (now.getMonth() + 2);
  console.log('🔮 [predict] Predicting for month_index =', nextMonthIndex);

  const [job] = await bigquery.createQueryJob({
    query: `
      SELECT
        category,
        predicted_monthly_expense
      FROM ML.PREDICT(MODEL \`${datasetId}.category_predictor\`,
        (
          SELECT userId, category, @monthIndex AS month_index
          FROM \`${datasetId}.user_monthly_category_expenses\`
          WHERE userId = @userId
        )
      );
    `,
    params: { userId: prismaUserId, monthIndex: nextMonthIndex },
    location: 'US',
  });

  const [predictions] = await job.getQueryResults();
  console.log('📊 [predict] Predictions:', predictions);
  return predictions;
}

export async function GET() {
  // 0. Authenticate with Clerk
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
//   const user = await db.user.findUnique({
//       where: { clerkUserId: clerkUserId },
//     });

  // 1. Map Clerk userId to Prisma users.id
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    // select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: 'User not found in database' },
      { status: 404 }
    );
  }
  const prismaUserId = user.id;
  console.log('✅ Mapped Clerk ID → Prisma ID:', prismaUserId);

  try {
    // 2. Sync new transactions
    await uploadToBigQuery(prismaUserId);

    // 3. Generate predictions
    const predictions = await predictPerCategoryPerUser(prismaUserId);

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error('❌ [route] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
