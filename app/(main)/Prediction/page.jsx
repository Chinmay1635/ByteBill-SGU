'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

// Converts month_index to "YYYY-MM"
function decodeMonthIndex(monthIndex) {
  let year = Math.floor(monthIndex / 12);
  let month = monthIndex % 12;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export default function PredictionPage() {
  const [monthlySummary, setMonthlySummary] = useState({});
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      setError('Please log in to view your predictions.');
      setStatus('error');
      return;
    }

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/predict', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Prediction fetch failed');

        setPredictions(data.predictions || []);

        const summary = {}; // Placeholder if you want to re-enable actual data
        setMonthlySummary(summary);
        setStatus('ready');
      } catch (err) {
        console.error('API error:', err);
        setError(err.message);
        setStatus('error');
      }
    })();
  }, [isSignedIn, getToken]);

  if (status === 'loading') return <p className="p-4">⏳ Loading predictions…</p>;
  if (status === 'error') return <p className="p-4 text-red-600">{error}</p>;

  // Collect all months from predictions
  const allMonths = new Set();
  predictions.forEach(pred => {
    const predMonth = decodeMonthIndex(pred.month_index);
    allMonths.add(predMonth);
  });

  const months = Array.from(allMonths).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const categories = [...new Set(predictions.map(p => p.category))];

  const colorPalette = [
    '#ff6b6b', '#f7b731', '#4b7bec', '#20bf6b',
    '#8854d0', '#fa8231', '#45aaf2', '#a55eea'
  ];

  const predictedExpenseDatasets = categories.map((category, index) => {
    const predMap = {};
    predictions.forEach(p => {
      if (p.category === category) {
        predMap[decodeMonthIndex(p.month_index)] = p.predicted_monthly_expense;
      }
    });

    return {
      label: `${category} (Predicted)`,
      data: months.map(month => predMap[month] || null),
      borderColor: colorPalette[index % colorPalette.length],
      backgroundColor: colorPalette[index % colorPalette.length],
      borderDash: [6, 6],
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  const chartData = {
    labels: months,
    datasets: [...predictedExpenseDatasets], // Add actualExpenseDatasets here if needed
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: { mode: 'index', intersect: false },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: {
        title: { display: true, text: 'Month' },
        grid: { display: true },
      },
      y: {
        title: { display: true, text: 'Expense (₹)' },
        grid: { display: true },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-20">
      <h1 className="text-3xl font-bold mb-6 text-center">📊 Monthly Expense Overview</h1>

      <div className="bg-white p-4 rounded shadow mb-10">
        <Line data={chartData} options={chartOptions} />
      </div>

      <h2 className="text-2xl font-semibold mb-4">🔮 Predicted Expenses (Last 5 Months)</h2>
      {predictions.length === 0 ? (
        <p>No predicted expenses available.</p>
      ) : (
        Object.entries(
          predictions.reduce((acc, curr) => {
            const label = decodeMonthIndex(curr.month_index);
            if (!acc[label]) acc[label] = [];
            acc[label].push(curr);
            return acc;
          }, {})
        )
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .map(([label, items]) => (
            <div key={label} className="mb-6">
              <h3 className="text-lg font-medium mb-2">{label}</h3>
              <ul className="space-y-2">
                {items.map(({ category, predicted_monthly_expense }, i) => (
                  <li
                    key={i}
                    className="flex justify-between p-3 border rounded shadow-sm"
                  >
                    <span className="font-medium">{category}</span>
                    <span>₹{predicted_monthly_expense.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </div>
  );
}
