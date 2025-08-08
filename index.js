// index.js
// Import necessary libraries
const express = require('express');
const axios = require('axios'); // Used to communicate with APIs
const path = require('path');

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;
const ZENO_API_KEY = process.env.ZENOPAY_API_KEY;
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY; // API Key for currency conversion
const ZENO_API_URL = "https://zenoapi.com/api/payments/checkout/";

// Define a base price in USD. This will be converted to the local currency.
const BASE_PRICE_USD = 2.50; 

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Web Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to handle the payment submission
app.post('/pay', async (req, res) => {
    const { phone } = req.body;
    
    // Get the user's country code from Vercel's request headers. Default to 'KE' (Kenya) if not found.
    const countryCode = req.headers['x-vercel-ip-country'] || 'KE';

    let currency = 'USD';
    let finalAmount = BASE_PRICE_USD;

    // A map to determine the local currency for specific countries
    const countryCurrencyMap = {
        'TZ': 'TZS',
        'KE': 'KES',
        'UG': 'UGX',
        'NG': 'NGN',
        'ZA': 'ZAR',
        'RW': 'RWF', // Rwanda
        'GH': 'GHS', // Ghana
    };

    if (countryCurrencyMap[countryCode]) {
        currency = countryCurrencyMap[countryCode];
        
        // Only perform conversion if an API key is provided
        if (EXCHANGE_RATE_API_KEY) {
            try {
                // Fetch the latest conversion rate from USD to the local currency
                const exchangeApiUrl = `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/pair/USD/${currency}`;
                const rateResponse = await axios.get(exchangeApiUrl);
                const conversionRate = rateResponse.data.conversion_rate;

                if (!conversionRate) {
                    throw new Error(`Could not get conversion rate for ${currency}`);
                }
                
                // Calculate the price in the local currency
                let convertedAmount = BASE_PRICE_USD * conversionRate;

                // Round up the amount to a more sensible number for local currencies
                // Example: 6123.45 TZS becomes 6200 TZS
                if (['TZS', 'KES', 'UGX', 'RWF'].includes(currency)) {
                    finalAmount = Math.ceil(convertedAmount / 100) * 100;
                } else {
                    finalAmount = Math.ceil(convertedAmount);
                }

            } catch (apiError) {
                console.error("Currency conversion API error:", apiError.message);
                // If conversion fails for any reason, we fall back to the default USD price.
                currency = 'USD';
                finalAmount = BASE_PRICE_USD;
            }
        }
    }

    const REDIRECT_URL = `${req.protocol}://${req.get('host')}/uthibitisho.html`;

    // Payload for the ZenoPay Multi-Currency Checkout API
    const payload = {
        "amount": finalAmount,
        "currency": currency,
        "buyer_name": phone || "Customer",
        "buyer_email": `${phone || 'customer-' + Date.now()}@zenopay.com`,
        "buyer_phone": phone || "N/A",
        "redirect_url": REDIRECT_URL
    };

    const headers = {
        "Content-Type": "application/json",
        "x-api-key": ZENO_API_KEY
    };

    try {
        const response = await axios.post(ZENO_API_URL, payload, { headers });
        console.log("ZenoPay API Response:", response.data);
        if (response.data && response.data.payment_link) {
            res.json({
                payment_link: response.data.payment_link
            });
        } else {
            res.status(400).json({
                error: "Ombi la Malipo Halikufanikiwa. Hatukuweza kupata linki ya malipo."
            });
        }
    } catch (error) {
        const errorMsg = error.response ? error.response.data : error.message;
        console.error("An error occurred with ZenoPay:", errorMsg);
        res.status(500).json({
            error: "Samahani, kumetokea tatizo la kimfumo. Tafadhali jaribu tena baadae."
        });
    }
});

// Export the app for Vercel
module.exports = app;
