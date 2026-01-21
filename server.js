const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
app.use(cors());
app.use(express.json());

// قاعدة بيانات JSON
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

// تهيئة قاعدة البيانات
async function initializeDB() {
    await db.read();
    db.data ||= { links: [], messages: [], users: [] };
    await db.write();
}

initializeDB();

// إعدادات التليجرام
const TELEGRAM_BOT_TOKEN = "8319256664:AAHw0suclrThu0X3dcdeoDT1LPwWRb59xR4";
const TELEGRAM_CHAT_ID = "6612813200";
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// إنشاء رابط جديد
app.post('/api/create-link', async (req, res) => {
    try {
        const { linkId, code, linkUrl } = req.body;
        
        // حفظ في قاعدة البيانات
        await db.read();
        
        // التحقق من عدم تكرار الرمز
        const existingCode = db.data.links.find(link => link.code === code);
        if (existingCode) {
            return res.status(400).json({ 
                success: false, 
                error: 'هذا الرمز مستخدم بالفعل' 
            });
        }
        
        // إضافة الرابط الجديد
        db.data.links.push({
            id: linkId,
            code: code,
            url: linkUrl,
            created: new Date().toISOString(),
            telegramChatId: null, // سيتم تعبئته عندما يربط المستخدم
            telegramLinked: false,
            messages: []
        });
        
        await db.write();
        
        // إرسال إشعار للتليجرام للمسؤول
        bot.sendMessage(TELEGRAM_CHAT_ID,
            `📌 رابط جديد تم إنشاؤه!\n\n` +
            `🔗 الرابط: ${linkUrl}\n` +
            `🔐 رمز الربط: ${code}\n` +
            `🆔 معرف الرابط: ${linkId}\n` +
            `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`
        );
        
        res.json({ 
            success: true, 
            message: 'تم إنشاء الرابط بنجاح',
            data: { linkId, code, linkUrl }
        });
        
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({ success: false, error: 'خطأ في الخادم' });
    }
});

// ربط رمز بـ chat_id (يستدعيها البوت)
app.post('/api/link-code', async (req, res) => {
    try {
        const { code, chatId } = req.body;
        
        await db.read();
        
        // البحث عن الرابط بالرمز
        const linkIndex = db.data.links.findIndex(link => link.code === code);
        
        if (linkIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'الرمز غير صحيح' 
            });
        }
        
        // تحديث الرابط بربطه بـ chat_id
        db.data.links[linkIndex].telegramChatId = chatId;
        db.data.links[linkIndex].telegramLinked = true;
        db.data.links[linkIndex].linkedAt = new Date().toISOString();
        
        await db.write();
        
        // إضافة المستخدم لقاعدة البيانات
        const existingUser = db.data.users.find(user => user.chatId === chatId);
        if (!existingUser) {
            db.data.users.push({
                chatId: chatId,
                code: code,
                linkId: db.data.links[linkIndex].id,
                registeredAt: new Date().toISOString()
            });
            await db.write();
        }
        
        // إرسال رسالة تأكيد للمستخدم
        bot.sendMessage(chatId,
            `✅ تم ربط حسابك بنجاح!\n\n` +
            `🔐 الرمز: ${code}\n` +
            `🔗 رابطك: ${db.data.links[linkIndex].url}\n\n` +
            `الآن ستصل إليك إشعارات عند وصول رسائل جديدة.`
        );
        
        // إرسال إشعار للمسؤول
        bot.sendMessage(TELEGRAM_CHAT_ID,
            `🔗 رمز جديد تم ربطه!\n\n` +
            `🔐 الرمز: ${code}\n` +
            `👤 Chat ID: ${chatId}\n` +
            `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`
        );
        
        res.json({ 
            success: true, 
            message: 'تم ربط الرمز بنجاح',
            data: {
                code: code,
                chatId: chatId,
                linkUrl: db.data.links[linkIndex].url
            }
        });
        
    } catch (error) {
        console.error('Error linking code:', error);
        res.status(500).json({ success: false, error: 'خطأ في الخادم' });
    }
});

// إرسال رسالة
app.post('/api/send-message', async (req, res) => {
    try {
        const { linkId, message } = req.body;
        
        await db.read();
        
        // البحث عن الرابط
        const link = db.data.links.find(link => link.id === linkId);
        
        if (!link) {
            return res.status(404).json({ 
                success: false, 
                error: 'الرابط غير موجود' 
            });
        }
        
        // حفظ الرسالة
        const messageData = {
            id: Date.now().toString(),
            linkId: linkId,
            text: message,
            timestamp: new Date().toISOString(),
            senderIp: req.ip
        };
        
        db.data.messages.push(messageData);
        
        // إضافة الرسالة للرابط
        link.messages.push({
            text: message,
            timestamp: new Date().toISOString()
        });
        
        await db.write();
        
        // إرسال إشعار للمسؤول
        bot.sendMessage(TELEGRAM_CHAT_ID,
            `📩 رسالة جديدة وردت!\n\n` +
            `🔗 الرابط: ${link.url}\n` +
            `🔐 الرمز: ${link.code}\n` +
            `✉️ الرسالة: ${message}\n` +
            `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}\n` +
            `🌐 IP: ${req.ip}`
        );
        
        // إرسال إشعار لصاحب الرابط إذا كان مرتبطاً
        if (link.telegramLinked && link.telegramChatId) {
            try {
                bot.sendMessage(link.telegramChatId,
                    `📩 رسالة جديدة وردت على رابطك!\n\n` +
                    `✉️ الرسالة: ${message}\n` +
                    `🕒 الوقت: ${new Date().toLocaleString('ar-EG')}`
                );
            } catch (telegramError) {
                console.error('Error sending to user:', telegramError);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'تم إرسال الرسالة بنجاح',
            data: messageData
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'خطأ في الخادم' });
    }
});

// الحصول على معلومات رابط
app.get('/api/link-info/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        await db.read();
        
        const link = db.data.links.find(link => link.id === linkId);
        
        if (!link) {
            return res.status(404).json({ 
                success: false, 
                error: 'الرابط غير موجود' 
            });
        }
        
        res.json({ 
            success: true, 
            data: {
                id: link.id,
                code: link.code,
                url: link.url,
                telegramLinked: link.telegramLinked,
                messagesCount: link.messages.length,
                created: link.created
            }
        });
        
    } catch (error) {
        console.error('Error getting link info:', error);
        res.status(500).json({ success: false, error: 'خطأ في الخادم' });
    }
});

// الحصول على معلومات بالرمز
app.get('/api/code-info/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        await db.read();
        
        const link = db.data.links.find(link => link.code === code);
        
        if (!link) {
            return res.status(404).json({ 
                success: false, 
                error: 'الرمز غير صحيح' 
            });
        }
        
        res.json({ 
            success: true, 
            data: {
                id: link.id,
                code: link.code,
                url: link.url,
                telegramLinked: link.telegramLinked,
                telegramChatId: link.telegramChatId,
                messagesCount: link.messages.length,
                created: link.created
            }
        });
        
    } catch (error) {
        console.error('Error getting code info:', error);
        res.status(500).json({ success: false, error: 'خطأ في الخادم' });
    }
});

// نقطة فحص صحة السيرفر
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Anonymous Messages Server'
    });
});

// خدمة الملفات الثابتة
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
});
