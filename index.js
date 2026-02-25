require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { OpenRouter } = require('@openrouter/sdk');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'https://portfolio-mdzeeshan.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ],
    credentials: true,
}));
app.use(express.json());

// OpenRouter AI setup
const openrouter = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || ''
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this if using a different provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Zeeshan's persona context for the AI
const SYSTEM_CONTEXT = `You are an AI assistant for MD Zeeshan's personal portfolio website.

About MD Zeeshan:
- Full name: MD (Mohammed) Zeeshan
- Currently pursuing B.E. in Information Technology at Jadavpur University (India's top engineering college)
- JEE Advanced Rank: 9,591 | JEE Mains Rank: 21,571
- YouTuber and JEE mentor since 2022 — helps students crack JEE exams
- Skills: Programming (Python, HTML/CSS, JavaScript, React — beginner-intermediate), Video editing (DaVinci Resolve, Premiere Pro — advanced), Content creation, Mentorship
- Soft Skills: Problem-solving, analytical thinking, communication, leadership
- Motto: "Rational Thinking Only"
- Contact: mdzeeshan08886@gmail.com | +91 9088260058
- LinkedIn: linkedin.com/in/tipz-gaming-1431262a5
- YouTube Channel: youtube.com/channel/UCkiJbacU_72kjE6z_w4aPAA
- Location: Kolkata, India
- Hobbies: Gaming, Writing, Music

Your job:
- Answer questions about Zeeshan's background, skills, education, projects, and contact info
- Be helpful, friendly, and professional
- If asked something unrelated to Zeeshan's portfolio (e.g. random trivia), politely redirect the conversation back to what you can help with
- Keep responses concise (max 3-4 sentences unless the question requires more detail)
- Never make up facts about Zeeshan that aren't listed above
- Speak in first person as Zeeshan's assistant, not as Zeeshan himself`;

// Database connection


// Database logic moved to individual routes for Serverless Cold Start reliability
async function connectDB() {
    if (mongoose.connection.readyState === 1) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

// Contact Schema
const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    date: { type: Date, default: Date.now }
});
const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

// Chat history Schema (optional - for logging)
const chatSchema = new mongoose.Schema({
    userMessage: String,
    aiReply: String,
    timestamp: { type: Date, default: Date.now }
});
const ChatLog = mongoose.models.ChatLog || mongoose.model('ChatLog', chatSchema);

// ─── Routes ───

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running.' });
});

app.get('/', (req, res) => {
    res.send('Backend server is running on Render!');
});

// Contact form
app.post('/api/contact', async (req, res) => {
    try {
        await connectDB();
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
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
            // Send email asynchronously (don't wait to return response to user)
            transporter.sendMail(mailOptions).catch(err => console.error('Email send failed:', err));
        }

        res.status(201).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Contact Form Error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// Shared smart fallback reply logic
function getSmartFallback(message) {
    const fallbackReplies = {
        contact: "You can reach Zeeshan at mdzeeshan08886@gmail.com or call +91 9088260058. He's also on LinkedIn at linkedin.com/in/tipz-gaming-1431262a5! 📬",
        jee: "Zeeshan achieved JEE Advanced Rank 9,591 and JEE Mains Rank 21,571 — a remarkable feat! He now channels that experience into mentoring JEE aspirants through his YouTube channel. 🎯",
        university: "Zeeshan is pursuing B.E. in Information Technology at Jadavpur University — consistently ranked among India's top engineering institutions. 🎓",
        youtube: "Zeeshan has been running a YouTube channel since 2022, dedicated to JEE guidance and mentorship. He helps thousands of students crack one of the toughest exams in India! 📺",
        skills: "Zeeshan is skilled in Python, HTML/CSS, JavaScript, and React (beginner-intermediate level), plus advanced video editing with DaVinci Resolve and Premiere Pro. He also has strong soft skills in problem-solving and analytical thinking. 💻",
        projects: "Zeeshan's key projects include his YouTube JEE mentorship channel, this portfolio website, and a video editing internship. His motto is 'Rational Thinking Only' — and it shows in his work! 🚀",
        location: "Zeeshan is based in Kolkata, India and is currently a student at Jadavpur University. 📍",
        hobby: "Beyond tech and studies, Zeeshan enjoys gaming, writing, and music. 🎮🎵",
        hello: "Hey there! 👋 I'm Zeeshan's AI assistant. I can tell you all about his education, JEE journey, skills, projects, and how to reach him. What would you like to know?",
        name: "MD Zeeshan (Mohammed Zeeshan) is an IT student at Jadavpur University, a JEE mentor, and content creator from Kolkata, India.",
        default: "That's a great question! I'm Zeeshan's portfolio assistant. I can help with info about his education, JEE ranks, skills, projects, or contact details. Try asking one of those! 😊"
    };

    const msg = message.toLowerCase();
    if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey') || msg === 'yes' || msg === 'ok') return fallbackReplies.hello;
    if (msg.includes('name') || msg.includes('who') || msg.includes('zeeshan')) return fallbackReplies.name;
    if (msg.includes('contact') || msg.includes('email') || msg.includes('phone') || msg.includes('reach') || msg.includes('linkedin')) return fallbackReplies.contact;
    if (msg.includes('jee') || msg.includes('rank') || msg.includes('exam') || msg.includes('iit')) return fallbackReplies.jee;
    if (msg.includes('university') || msg.includes('college') || msg.includes('jadavpur') || msg.includes('education') || msg.includes('study') || msg.includes('degree')) return fallbackReplies.university;
    if (msg.includes('youtube') || msg.includes('channel') || msg.includes('video') || msg.includes('mentor')) return fallbackReplies.youtube;
    if (msg.includes('skill') || msg.includes('python') || msg.includes('react') || msg.includes('code') || msg.includes('javascript') || msg.includes('programming') || msg.includes('tech')) return fallbackReplies.skills;
    if (msg.includes('project') || msg.includes('work') || msg.includes('edit') || msg.includes('portfolio')) return fallbackReplies.projects;
    if (msg.includes('location') || msg.includes('kolkata') || msg.includes('india') || msg.includes('where')) return fallbackReplies.location;
    if (msg.includes('hobby') || msg.includes('hobbies') || msg.includes('game') || msg.includes('music') || msg.includes('interest')) return fallbackReplies.hobby;
    return fallbackReplies.default;
}

// AI Chat — OpenRouter powered
app.post('/api/chat', async (req, res) => {
    let message = '';
    try {
        await connectDB();
        const { message: msg, history = [] } = req.body;
        message = msg || '';

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Check if API key is configured
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
            return res.status(200).json({ reply: getSmartFallback(message) });
        }

        // Build OpenRouter messages format
        const messages = [
            { role: 'system', content: SYSTEM_CONTEXT }
        ];

        // Map existing history
        const chatHistory = history.map(h => ({
            role: h.role === 'ai' ? 'assistant' : 'user',
            content: h.content
        }));

        // Find the first user message index to trim system/greeting from history
        const firstUserIdx = chatHistory.findIndex(m => m.role === 'user');
        const trimmedHistory = firstUserIdx === -1 ? [] : chatHistory.slice(firstUserIdx);

        messages.push(...trimmedHistory);
        messages.push({ role: 'user', content: message });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://portfolio-mdzeeshan.vercel.app',
                'X-Title': 'Zeeshan Portfolio Chatbot',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemma-3-4b-it:free',
                messages: messages,
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "I couldn't process that. Please ask about Zeeshan's skills or contact info!";

        // Log to DB (non-blocking)
        ChatLog.create({ userMessage: message, aiReply: reply }).catch(() => { });

        res.status(200).json({ reply });
    } catch (error) {
        console.error('Chat Error:', error.message);
        // Use smart fallback even on API errors
        res.status(200).json({ reply: getSmartFallback(message) });
    }
});

// Start server locally; export for Vercel serverless
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

module.exports = app;

