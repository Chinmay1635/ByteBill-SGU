// app/api/predict/route.js

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();
const credential = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString()
);

const bigquery = new BigQuery({
  projectId: 'hopes-455920',
  credentials: credential,
});

const datasetId = 'expense_data';
const tableId = 'expenses';

async function uploadToBigQuery(prismaUserId) {
  console.log('🔄 [upload] Start for Prisma user.id:', prismaUserId);

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

  const filter = { userId: prismaUserId };
  if (lastDate && !isNaN(new Date(lastDate))) {
    filter.date = { gt: new Date(lastDate) };
  }

  const expenses = await prisma.transaction.findMany({ where: filter });
  console.log(`📦 [upload] Found ${expenses.length} new transactions`);

  if (!expenses.length) return;

  const rows = expenses.map(e => ({
    type: e.type.toString(),
    amount: parseFloat(e.amount),
    category: e.category,
    date: e.date.toISOString().split('T')[0],
    description: e.description || '',
    userId: e.userId,
  }));

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
      EXTRACT(YEAR FROM DATE(date)) * 12 + EXTRACT(MONTH FROM DATE(date)) AS month_index,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS monthly_expense
    FROM \`${datasetId}.${tableId}\`
    GROUP BY userId, category, month_index;
  `);

  console.log('🔄 [predict] Training model…');
  try {
    await bigquery.query(`
      CREATE OR REPLACE MODEL \`${datasetId}.category_predictor\`
      OPTIONS (
        model_type = 'BOOSTED_TREE_REGRESSOR',
        input_label_cols = ['monthly_expense'],
        num_iterations = 15,
        max_tree_depth = 3
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

  const now = new Date();
  const currentMonthIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
  const monthIndexes = Array.from({ length: 6 }, (_, i) => currentMonthIndex - 4 + i);

  console.log('🔮 [predict] Predicting for month_indexes =', monthIndexes);

  const [job] = await bigquery.createQueryJob({
    query: `
      SELECT
        category,
        month_index,
        predicted_monthly_expense
      FROM ML.PREDICT(MODEL \`${datasetId}.category_predictor\`,
        (
          SELECT userId, category, month_index
          FROM \`${datasetId}.user_monthly_category_expenses\`
          WHERE userId = @userId AND month_index IN UNNEST(@monthIndexes)
        )
      )
      WHERE predicted_monthly_expense > 0
      ORDER BY category, month_index;
    `,
    params: {
      userId: prismaUserId,
      monthIndexes,
    },
    location: 'US',
  });

  const [predictions] = await job.getQueryResults();
  console.log('📊 [predict] Predictions:', predictions);

  return predictions.map(p => ({
    ...p,
    predicted_monthly_expense: p.predicted_monthly_expense,
  }));
}

export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
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
    await uploadToBigQuery(prismaUserId);
    const predictions = await predictPerCategoryPerUser(prismaUserId);

    const rawTransactions = await prisma.transaction.findMany({
      where: { userId: prismaUserId, type: 'EXPENSE' },
      select: {
        createdAt: true,
        amount: true,
      },
    });

    const transactions = rawTransactions.map(tx => ({
      date: tx.createdAt.toISOString(),
      amount: tx.amount,
    }));

    return NextResponse.json(
      { predictions, transactions },
      { status: 200 }
    );
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
