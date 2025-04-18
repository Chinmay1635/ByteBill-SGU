import React from "react"

const financeWords = [
  "Savings", "Budget", "Expense Management", "Financial Planning", "Cash Flow", 
  "Debt Management", "Financial Goals", "Emergency Fund", "Tracking Expenses", 
  "Net Worth", "Cash Reserve", "Spending Limit", "Income Tracking", 
  "Debt-to-Income Ratio", "Investments", "Monthly Expenses", "Financial Dashboard", 
  "Tracking Investments", "Recurring Expenses", "Cost-Cutting", "Expenditure", 
  "Savings Goal", "Disposable Income", "Balance Sheet", "Financial Health", 
  "Expense Breakdown", "Financial Statement", "Cost Analysis", "Cash Flow Forecast", 
  "Personal Finance", "Investment Strategy", "Profit & Loss"
];


const getRandomIndexes = (length, count) => {
  const indexes = new Set()
  while (indexes.size < count) {
    indexes.add(Math.floor(Math.random() * length))
  }
  return Array.from(indexes)
}

const FinanceTicker = () => {
  const pulseIndexes1 = getRandomIndexes(financeWords.length, 2)
  const pulseIndexes2 = getRandomIndexes(financeWords.length, 2)
  const pulseIndexes3 = getRandomIndexes(financeWords.length, 2)

  return (
    <section className="bg-white py-12 px-4 shadow-inner rounded-lg">
      {/* Row 1: Left to Right */}
      <div className="overflow-hidden whitespace-nowrap py-4">
        <div className="flex animate-marquee-left gap-10">
          {financeWords.concat(financeWords).map((word, index) => (
            <span
              key={`row1-${index}`}
              className={`text-primary text-3xl font-bold transition-transform duration-500 ${
                pulseIndexes1.includes(index % financeWords.length) ? 'animate-pulse-scale' : ''
              }`}
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      {/* Row 2: Right to Left */}
      <div className="overflow-hidden whitespace-nowrap py-4">
        <div className="flex animate-marquee-right gap-10">
          {[...financeWords].reverse().concat([...financeWords].reverse()).map((word, index) => (
            <span
              key={`row2-${index}`}
              className={`text-blue-900 text-2xl font-serif italic transition-transform duration-500 ${
                pulseIndexes2.includes(index % financeWords.length) ? 'animate-pulse-scale' : ''
              }`}
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      {/* Row 3: Left to Right Fast */}
      <div className="overflow-hidden whitespace-nowrap py-4">
        <div className="flex animate-marquee-left-fast gap-10">
          {financeWords.slice(10).concat(financeWords.slice(0, 10)).concat(financeWords.slice(10)).map((word, index) => (
            <span
              key={`row3-${index}`}
              className={`text-gray-700 text-xl font-mono uppercase tracking-widest transition-transform duration-500 ${
                pulseIndexes3.includes(index % financeWords.length) ? 'animate-pulse-scale' : ''
              }`}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FinanceTicker