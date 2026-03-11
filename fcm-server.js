const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 1. Load the JSON key you downloaded
const serviceAccount = require('./service-account.json');

// 2. Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

// 3. API Endpoint to send ping to a specific token
app.post('/send-ping', async (req, res) => {
  const { token, action } = req.body;

  if (!token) {
    return res.status(400).send({ error: 'Token is required' });
  }

  const message = {
    token: token,
    data: {
      action: action || 'WAKE_UP_NOW',
    },
    android: {
      priority: 'high',
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    res.status(200).send({ success: true, response });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send({ error: error.message });
  }
});

// 4. API Endpoint to send ping to a Topic (All Users)
app.post('/send-ping-all', async (req, res) => {
  const { action } = req.body;

  const message = {
    topic: 'wake_up_all',
    data: {
      action: action || 'WAKE_UP_NOW',
    },
    android: {
      priority: 'high',
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message to all:', response);
    res.status(200).send({ success: true, response });
  } catch (error) {
    console.error('Error sending message to all:', error);
    res.status(500).send({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`FCM Server is running on http://localhost:${PORT}`);
  console.log(`Don't close this terminal while using the Admin Panel!`);
});
