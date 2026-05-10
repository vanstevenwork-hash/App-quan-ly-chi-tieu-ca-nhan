const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create a transporter
    // For demo purposes, we will log the email instead of failing if credentials are not set
    const hasCredentials = process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your-email@gmail.com';
    
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // 2. Define the email options
    const mailOptions = {
        from: `Zenith Finance <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    // 3. Actually send the email
    if (hasCredentials) {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${options.email}`);
    } else {
        console.log('⚠️ Email credentials not configured. Simulating email sending:');
        console.log(`To: ${options.email}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body: ${options.message}`);
    }
};

module.exports = sendEmail;
