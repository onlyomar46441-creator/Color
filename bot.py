import logging
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# إعدادات السيرفر
SERVER_URL = "https://your-server.herokuapp.com"  # استبدل برابط سيرفرك

# إعدادات التليجرام
TELEGRAM_BOT_TOKEN = "8319256664:AAHw0suclrThu0X3dcdeoDT1LPwWRb59xR4"
ADMIN_CHAT_ID = "6612813200"

# إعدادات التسجيل
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """معالجة أمر /start"""
    await update.message.reply_text(
        "👋 مرحباً بك في بوت رسائل مجهولة!\n\n"
        "🔹 لربط حسابك، أرسل لي الرمز الذي حصلت عليه من الموقع.\n\n"
        "🔹 بعد الربط، ستصل إليك إشعارات عندما يرسل لك أحد رسالة مجهولة.\n\n"
        "💡 انسخ الرمز من الموقع وأرسله لي."
    )

async def handle_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """معالجة الرموز المرسلة"""
    code = update.message.text.strip()
    chat_id = str(update.message.chat_id)
    
    # التحقق من طول الرمز
    if len(code) < 8 or len(code) > 12:
        await update.message.reply_text("❌ الرمز غير صالح. الرجاء إرسال رمز صحيح.")
        return
    
    # التحقق من أن الرمز يحتوي على أحرف وأرقام
    if code.isdigit():
        await update.message.reply_text("❌ الرمز يجب أن يحتوي على أحرف وأرقام معاً.")
        return
    
    try:
        # إرسال الطلب للسيرفر لربط الرمز
        response = requests.post(
            f"{SERVER_URL}/api/link-code",
            json={
                "code": code,
                "chatId": chat_id
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("success"):
                await update.message.reply_text(
                    f"✅ تم ربط حسابك بنجاح!\n\n"
                    f"🔐 الرمز: {code}\n"
                    f"🆔 حسابك: {chat_id}\n\n"
                    f"الآن ستصل إليك إشعارات عند وصول رسائل جديدة.\n"
                    f"يمكنك مشاركة رابطك مع أصدقائك لاستقبال رسائل مجهولة."
                )
            else:
                error_msg = data.get("error", "حدث خطأ غير معروف")
                await update.message.reply_text(f"❌ {error_msg}")
                
        elif response.status_code == 404:
            await update.message.reply_text("❌ الرمز غير صحيح. تأكد من الرمز وحاول مرة أخرى.")
        else:
            await update.message.reply_text("❌ حدث خطأ في الخادم. حاول مرة أخرى لاحقاً.")
            
    except requests.exceptions.RequestException as e:
        logging.error(f"Request error: {e}")
        await update.message.reply_text("❌ تعذر الاتصال بالخادم. حاول مرة أخرى لاحقاً.")
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        await update.message.reply_text("❌ حدث خطأ غير متوقع. حاول مرة أخرى.")

async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """إحصائيات للمسؤول (أمر سري)"""
    chat_id = str(update.message.chat_id)
    
    # التحقق من أن المرسل هو المسؤول
    if chat_id != ADMIN_CHAT_ID:
        await update.message.reply_text("❌ غير مصرح لك باستخدام هذا الأمر.")
        return
    
    try:
        # جلب الإحصائيات من السيرفر
        stats_response = requests.get(f"{SERVER_URL}/api/stats", timeout=10)
        
        if stats_response.status_code == 200:
            stats = stats_response.json()
            await update.message.reply_text(
                f"📊 إحصائيات النظام:\n\n"
                f"🔗 عدد الروابط: {stats.get('totalLinks', 0)}\n"
                f"👤 عدد المستخدمين: {stats.get('totalUsers', 0)}\n"
                f"📩 عدد الرسائل: {stats.get('totalMessages', 0)}\n"
                f"🔗 المرتبطة: {stats.get('linkedLinks', 0)}\n"
                f"⏰ آخر تحديث: {stats.get('lastUpdate', 'N/A')}"
            )
        else:
            await update.message.reply_text("❌ تعذر جلب الإحصائيات.")
            
    except Exception as e:
        logging.error(f"Stats error: {e}")
        await update.message.reply_text("❌ حدث خطأ في جلب الإحصائيات.")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """أمر المساعدة"""
    await update.message.reply_text(
        "❓ المساعدة:\n\n"
        "🔹 /start - بدء الاستخدام\n"
        "🔹 /help - عرض هذه الرسالة\n\n"
        "📝 لإرسال رسالة مجهولة:\n"
        "1. افتح الموقع وأنشئ رابطاً\n"
        "2. انسخ الرمز الذي تحصل عليه\n"
        "3. أرسل الرمز لي هنا\n"
        "4. شارك الرابط مع أصدقائك\n"
        "5. استقبل رسائل مجهولة!\n\n"
        "🌐 الموقع: https://onlyomar46441-creator.github.io/Color/index.html"
    )

def main():
    """الدالة الرئيسية لتشغيل البوت"""
    # إنشاء تطبيق البوت
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # إضافة handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("stats", admin_stats))  # أمر سري للمسؤول
    
    # معالجة الرسائل النصية (الرموز)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_code))
    
    # بدء البوت
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    print("🤖 بدء تشغيل بوت رسائل مجهولة...")
    main()
