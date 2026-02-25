"use strict";
require('dotenv').config();
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Mongoose Connection and schema (Serverless Pattern)
let Contact;
try {
    Contact = mongoose.model('Contact');
} catch {
    const contactSchema = new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true },
        message: { type: String, required: true },
        date: { type: Date, default: Date.now }
    });
    Contact = mongoose.model('Contact', contactSchema);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // 1. Save to database
        const newContact = new Contact({ name, email, message });
        await newContact.save();

        // 2. Send Auto-Reply Email
        if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
            const mailOptions = {
                from: `"MD Zeeshan" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Thank you for reaching out!',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #00d4ff;">Hello ${name},</h2>
                        <p>Thank you for reaching out through my portfolio website!</p>
                        <p>This is an automated message to let you know that I've successfully received your inquiry. I will review it and get back to you as soon as possible.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p><strong>A copy of your message:</strong><br>
                        <em>"${message}"</em></p>
                        <br>
                        <p>Best regards,<br>
                        <strong>MD Zeeshan</strong><br>
                        <a href="mailto:mdzeeshan08886@gmail.com">mdzeeshan08886@gmail.com</a></p>
                    </div>
                `
            };
            // Try to await it in serverless so it actually sends before lambda dies
            await transporter.sendMail(mailOptions);
        }

        res.status(201).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Contact Form Error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};
