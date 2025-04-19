'use client';

import { useEffect, useState } from 'react';
import { Download, LogOut, LogIn, FileSearch, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { saveAs } from 'file-saver';

const GmailBillsPage = () => {
  const [bills, setBills] = useState([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: 'rawDate',
    direction: 'desc',
  });
  const [pagination, setPagination] = useState({
    pageToken: null,
    currentPage: 0,
    totalResults: 0,
    resultsPerPage: 20,
  });

  useEffect(() => {
    const loadGapi = async () => {
      try {
        const gapi = await import('gapi-script').then((pkg) => pkg.gapi);
        await gapi.load('client:auth2', async () => {
          await gapi.client.init({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
          });
          await gapi.client.load('gmail', 'v1');

          const authInstance = gapi.auth2.getAuthInstance();
          setSignedIn(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen(setSignedIn);
        });
      } catch (error) {
        console.error('Error loading Google API:', error);
      }
    };

    if (typeof window !== 'undefined') {
      loadGapi();
    }
  }, []);

  const handleAuth = async (action) => {
    try {
      const gapi = await import('gapi-script').then((pkg) => pkg.gapi);
      const authInstance = gapi.auth2.getAuthInstance();

      if (action === 'signIn') {
        await authInstance.signIn();
      } else {
        await authInstance.signOut();
        setBills([]);
        setPagination({
          pageToken: null,
          currentPage: 0,
          totalResults: 0,
          resultsPerPage: 20,
        });
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
    }
  };

  const extractPlainText = (payload) => {
    const getPart = (parts, mimeType) => {
      for (const part of parts) {
        if (part.mimeType === mimeType && part.body?.data) {
          return part.body.data;
        }
        if (part.parts) {
          const found = getPart(part.parts, mimeType);
          if (found) return found;
        }
      }
      return null;
    };

    let bodyData = payload.body?.data;
    if (!bodyData && payload.parts) {
      bodyData = getPart(payload.parts, 'text/plain') || getPart(payload.parts, 'text/html');
    }

    if (bodyData) {
      return atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'));
    }

    return '[No body found]';
  };

  const extractBillDetails = (body, receivedDate) => {
    const amountMatch = body.match(
      /(?:total(?: amount)?|bill amount|amount paid|amount due|Total paid|Amount\s*[=:]\s*)[^₹$₹INR0-9]*[₹$]?\s?(?:Rs\.?|INR)?\s?([\d,]+(?:\.\d{2})?)/i
    );
    const billNumberMatch = body.match(/(?:Bill No|Invoice No|Order No:|Order ID:|Receipt No)[\s#:]*([A-Za-z0-9\-]+)/i);
    const vendorMatch = body.match(/(?:from|vendor|sold by|merchant|Bill for)[:\s]*([\w\s&.,'-]+)/i);

    let amountValue = 'Not found';
    if (amountMatch?.[1]) {
      amountValue = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    return {
      amount: amountMatch?.[1] || 'Not found',
      amountValue: amountValue,
      billNumber: billNumberMatch?.[1] || 'Not found',
      billDate: receivedDate || 'Not found',
      vendor: vendorMatch?.[1]?.trim() || 'Not found',
    };
  };

  const fetchBills = async (pageToken = null, direction = 'next') => {
    setLoading(true);
    try {
      const gapi = await import('gapi-script').then((pkg) => pkg.gapi);
      const res = await gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: '(bill OR invoice has:attachment OR Your Amazon.in order) OR (from:google-pay-noreply@google.com) OR (from:noreply@zomato.com)',
        maxResults: pagination.resultsPerPage,
        pageToken: pageToken,
      });

      const messages = res.result.messages || [];
      if (messages.length === 0) {
        setBills([{ message: 'No bill-related emails found.' }]);
        return;
      }

      const billData = await Promise.all(
        messages.map(async (msg) => {
          const msgDetail = await gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
          });

          const headers = msgDetail.result.payload.headers;
          const subject = headers.find((h) => h.name === 'Subject')?.value;
          const from = headers.find((h) => h.name === 'From')?.value;
          const date = headers.find((h) => h.name === 'Date')?.value;
          const formattedDate = new Date(date).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const rawDate = new Date(date);
          const body = extractPlainText(msgDetail.result.payload);
          const details = extractBillDetails(body, formattedDate);

          return {
            id: msg.id,
            subject,
            from,
            date: formattedDate,
            rawDate,
            ...details,
          };
        })
      );

      const sortedBills = requestSort(billData, 'rawDate', 'desc');
      setBills(sortedBills);
      
      setPagination(prev => ({
        ...prev,
        pageToken: res.result.nextPageToken || null,
        totalResults: res.result.resultSizeEstimate || 0,
        currentPage: direction === 'next' 
          ? prev.currentPage + 1 
          : Math.max(1, prev.currentPage - 1)
      }));
    } catch (error) {
      console.error('Error fetching bills:', error);
      setBills([{ error: 'Failed to fetch bills. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const requestSort = (data, key, direction = null) => {
    let sortDirection = direction;
    if (!direction) {
      sortDirection = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    const sortableData = [...data].filter(b => !b.message && !b.error);
    const sortedData = [...sortableData].sort((a, b) => {
      if (a[key] === 'Not found') return 1;
      if (b[key] === 'Not found') return -1;
      
      if (key === 'amountValue') {
        return sortDirection === 'asc' ? a.amountValue - b.amountValue : b.amountValue - a.amountValue;
      }
      
      if (key === 'rawDate') {
        return sortDirection === 'asc' ? a.rawDate - b.rawDate : b.rawDate - a.rawDate;
      }
      
      if (a[key] < b[key]) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (a[key] > b[key]) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    if (!direction) {
      setSortConfig({ key, direction: sortDirection });
    }
    
    const nonSortableItems = data.filter(b => b.message || b.error);
    return [...sortedData, ...nonSortableItems];
  };

  const handleSort = (key) => {
    const sortedBills = requestSort(bills, key);
    setBills(sortedBills);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? 
      <ChevronUp size={16} className="inline ml-1" /> : 
      <ChevronDown size={16} className="inline ml-1" />;
  };

  const downloadCSV = async () => {
    try {
      setExportLoading(true);
      const gapi = await import('gapi-script').then((pkg) => pkg.gapi);
      
      let allMessages = [];
      let pageToken = null;
      let hasMore = true;
      let batchCount = 0;
      const maxBatches = 10; // Safety limit to prevent infinite loops
  
      while (hasMore && batchCount < maxBatches) {
        batchCount++;
        const res = await gapi.client.gmail.users.messages.list({
          userId: 'me',
          q: '(bill OR invoice has:attachment OR Your Amazon.in order) OR (from:google-pay-noreply@google.com) OR (from:noreply@zomato.com) OR (from:noreply@phonepe.com) OR (from:noreply@paytm.com)',
          maxResults: 100, // Reduced from 500 to avoid timeouts
          pageToken: pageToken,
        });
  
        if (res.result.messages) {
          allMessages = [...allMessages, ...res.result.messages];
        }
  
        pageToken = res.result.nextPageToken;
        hasMore = !!pageToken;
  
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
  
      // Process messages in batches to avoid memory issues
      const batchSize = 20;
      const allBills = [];
      
      for (let i = 0; i < allMessages.length; i += batchSize) {
        const batch = allMessages.slice(i, i + batchSize);
        const batchBills = await Promise.all(
          batch.map(async (msg) => {
            try {
              const msgDetail = await gapi.client.gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full',
              });
  
              const headers = msgDetail.result.payload.headers;
              const subject = headers.find((h) => h.name === 'Subject')?.value || '';
              const from = headers.find((h) => h.name === 'From')?.value || '';
              const date = headers.find((h) => h.name === 'Date')?.value;
              const formattedDate = date ? new Date(date).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }) : 'No date';
              
              const body = extractPlainText(msgDetail.result.payload);
              const details = extractBillDetails(body, formattedDate);
  
              // Skip if no amount was found (likely not a real bill)
              if (details.amount === 'Not found') {
                return null;
              }
  
              return {
                vendor: details.vendor,
                subject: subject,
                from: from,
                date: formattedDate,
                amount: details.amount,
                billNumber: details.billNumber,
              };
            } catch (error) {
              console.error(`Error processing message ${msg.id}:`, error);
              return null;
            }
          })
        );
  
        // Filter out null entries and add to allBills
        allBills.push(...batchBills.filter(bill => bill !== null));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
  
      // Prepare CSV content
      const headers = ['Vendor', 'Subject', 'From', 'Date', 'Amount', 'Bill Number'];
      const rows = allBills.map(bill => [
        `"${(bill.vendor || '').replace(/"/g, '""')}"`,
        `"${(bill.subject || '').replace(/"/g, '""')}"`,
        `"${(bill.from || '').replace(/"/g, '""')}"`,
        `"${bill.date}"`,
        `"${bill.amount}"`,
        `"${bill.billNumber}"`
      ].join(','));
  
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `all_bills_${new Date().toISOString().slice(0,10)}.csv`);
      
    } catch (error) {
      console.error('Error downloading all bills:', error);
      alert('Failed to download all bills. Please try again with a smaller date range.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleNextPage = () => {
    if (pagination.pageToken) {
      fetchBills(pagination.pageToken, 'next');
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      fetchBills(null, 'prev');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Gmail Bill Extraction</h1>
      </div>

      {!signedIn ? (
        <div className="flex justify-center">
          <button
            onClick={() => handleAuth('signIn')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow flex items-center gap-2"
          >
            <LogIn size={18} /> Sign in with Google
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4 mb-6 justify-center flex-wrap">
            <button
              onClick={() => handleAuth('signOut')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2"
            >
              <LogOut size={18} /> Sign Out
            </button>
            <button
              onClick={() => fetchBills()}
              disabled={loading}
              className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FileSearch size={18} /> {loading ? 'Processing...' : 'Fetch Bills'}
            </button>
            <button
              onClick={downloadCSV}
              disabled={exportLoading || !signedIn}
              className={`bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2 ${
                exportLoading || !signedIn ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {exportLoading ? 'Preparing Download...' : (
                <>
                  <Download size={18} /> Download All as CSV
                </>
              )}
            </button>
          </div>

          {bills.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.currentPage - 1) * pagination.resultsPerPage) + 1}-{' '}
                  {Math.min(
                    pagination.currentPage * pagination.resultsPerPage,
                    pagination.totalResults
                  )}{' '}
                  of {pagination.totalResults} bills
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={pagination.currentPage === 1 || loading}
                    className={`px-3 py-1 border rounded flex items-center gap-1 ${pagination.currentPage === 1 || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={!pagination.pageToken || loading}
                    className={`px-3 py-1 border rounded flex items-center gap-1 ${!pagination.pageToken || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-collapse border border-gray-200 shadow-md rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-left">
                      <th className="px-6 py-3 border">Vendor</th>
                      <th className="px-6 py-3 border">Details</th>
                      <th 
                        className="px-6 py-3 border cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('rawDate')}
                      >
                        Date {getSortIcon('rawDate')}
                      </th>
                      <th 
                        className="px-6 py-3 border cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('amountValue')}
                      >
                        Amount {getSortIcon('amountValue')}
                      </th>
                      <th className="px-6 py-3 border">Bill #</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {bills.map((bill, index) => (
                      'error' in bill || 'message' in bill ? (
                        <tr key={index}>
                          <td colSpan="5" className="px-4 py-4 text-center text-red-500">
                            {bill.error || bill.message}
                          </td>
                        </tr>
                      ) : (
                        <tr key={bill.id} className="hover:bg-gray-50">
                          <td className="border px-6 py-4 font-medium text-gray-900">{bill.vendor}</td>
                          <td className="border px-6 py-4 text-gray-700">{bill.subject}</td>
                          <td className="border px-6 py-4 text-gray-600">{bill.date}</td>
                          <td className="border px-6 py-4 text-green-700 font-semibold">{bill.amount}</td>
                          <td className="border px-6 py-4 text-gray-500">{bill.billNumber}</td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GmailBillsPage;