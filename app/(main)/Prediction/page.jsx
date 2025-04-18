'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function PredictionPage() {
  const { isSignedIn, getToken } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'error' | 'ready'
  const [error, setError] = useState('');

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

        if (!res.ok) {
          throw new Error(data.error || data.details || 'Failed to fetch');
        }

        setPredictions(data.predictions || []);
        setStatus('ready');
      } catch (err) {
        console.error('API error:', err);
        setError(err.message);
        setStatus('error');
      }
    })();
  }, [isSignedIn, getToken]);

  if (status === 'loading') return <p className="p-4">⏳ Loading predictions…</p>;
  if (status === 'error')   return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="max-w-md mx-auto p-4 mt-24">
      <h1 className="text-2xl font-bold mb-4">📈 Expense Predictions</h1>

      {predictions.length === 0 ? (
        <p>No predicted expenses available.</p>
      ) : (
        <ul className="space-y-2">
          {predictions.map(({ category, predicted_monthly_expense }, i) => (
            <li
              key={i}
              className="flex justify-between p-3 border rounded shadow-sm"
            >
              <span className="font-medium">{category}</span>
              <span>₹{predicted_monthly_expense.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
