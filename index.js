// index.js
// Import necessary libraries
const express = require('express');
const axios = require('axios'); // Used to communicate with ZenoPay API
const path = require('path');

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000; // Vercel will set the port automatically
const API_KEY = process.env.ZENOPAY_API_KEY; // Get API Key from Vercel Environment Variables
const GROUP_PRICE = 5000; // The price for your WhatsApp group in TZS
const API_URL = "https://zenoapi.com/api/payments/checkout/"; // UPDATED API URL

// --- Middleware ---
// This allows our server to understand JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// --- Web Routes ---

// Route to serve the main payment page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to handle the payment submission
app.post('/pay', async (req, res) => {
    const { phone } = req.body;

    // Basic validation for the phone number
    if (!phone || !(phone.startsWith('07') || phone.startsWith('06')) || phone.length !== 10) {
        return res.status(400).json({
            error: "Namba si sahihi. Tafadhali rudi mwanzo uweke namba sahihi ya simu, mfano: 07xxxxxxxx."
        });
    }

    // The redirect URL where the user will be sent after payment
    const REDIRECT_URL = `${req.protocol}://${req.get('host')}/uthibitisho.html`;

    // Payload for the ZenoPay Multi-Currency Checkout API
    const payload = {
        "amount": GROUP_PRICE,
        "currency": "TZS", // You can change this to USD or any other supported currency
        "buyer_name": phone,
        "buyer_email": `${phone}@zenopay.com`, // A dummy email is fine
        "buyer_phone": phone,
        "redirect_url": REDIRECT_URL
    };

    // Headers for authentication
    const headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    };

    try {
        // Send the request to ZenoPay
        const response = await axios.post(API_URL, payload, { headers });

        console.log("ZenoPay API Response:", response.data);

        // Check if the response from ZenoPay contains a payment_link
        if (response.data && response.data.payment_link) {
            // Send the payment link back to the frontend
            res.json({
                payment_link: response.data.payment_link
            });
        } else {
            res.status(400).json({
                error: "Ombi la Malipo Halikufanikiwa. Hatukuweza kupata linki ya malipo."
            });
        }
    } catch (error) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
        res.status(500).json({
            error: "Samahani, kumetokea tatizo la kimfumo. Tafadhali jaribu tena baadae."
        });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
