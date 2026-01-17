"""
DH-Commerce Backend API - Complete with Email System
"""

import os
import json
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify
from flask_cors import CORS

# Conditional imports to fix colored lines
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth
    FIREBASE_AVAILABLE = True
except ImportError:
    print("⚠️ Firebase Admin not installed. Some features will be limited.")
    FIREBASE_AVAILABLE = False
    firebase_admin = None
    credentials = None
    firestore = None
    auth = None

try:
    from dotenv import load_dotenv
    load_dotenv()  # Load environment variables
    DOTENV_AVAILABLE = True
except ImportError:
    print("⚠️ python-dotenv not installed. Using environment variables directly.")
    DOTENV_AVAILABLE = False

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    import pytz
    SCHEDULER_AVAILABLE = True
except ImportError:
    print("⚠️ APScheduler/pytz not installed. Scheduled tasks disabled.")
    SCHEDULER_AVAILABLE = False
    BackgroundScheduler = None
    pytz = None

# ============================================
# INITIALIZE APP
# ============================================
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://ict-dh-commerce-project-1.onrender.com",  # Your frontend
            "http://localhost:5500"  # Keep for local development
        ]
    }
})


# Email configuration
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USER = os.environ.get('EMAIL_USER')
EMAIL_PASS = os.environ.get('EMAIL_PASS')
EMAIL_USE_TLS = True

# Timezone for scheduling
timezone = None
if SCHEDULER_AVAILABLE:
    timezone = pytz.timezone('America/New_York')

# ============================================
# FIREBASE SETUP
# ============================================
print("🚀 Initializing DH-Commerce Backend...")

db = None  # Firestore database

try:
    if FIREBASE_AVAILABLE:
        # Use serviceAccountKey.json file
        if os.path.exists('serviceAccountKey.json'):
            cred = credentials.Certificate('serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("✅ Firebase initialized successfully")
        else:
            print("❌ serviceAccountKey.json not found in backend folder!")
            print("   Make sure you saved it in the backend/ folder")
    else:
        print("❌ Firebase Admin SDK not installed")

except Exception as e:
    print(f"❌ Firebase error: {e}")
    db = None

# ============================================
# EMAIL FUNCTIONS
# ============================================


def send_email(to_email, subject, html_content):
    """Send email using SMTP"""
    try:
        print(f"📧 Attempting to send email to: {to_email}")
        print(f"📧 Using SMTP server: {EMAIL_HOST}:{EMAIL_PORT}")
        print(f"📧 Using login: {EMAIL_USER}")

        if not EMAIL_USER or not EMAIL_PASS:
            print("⚠️ Email credentials not set. Skipping email.")
            return False

        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"DH-Commerce <{EMAIL_USER}>"
        msg['To'] = to_email

        # Create HTML version
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)

        print("📧 Connecting to SMTP server...")
        # Send email
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            print("📧 Connection successful")
            if EMAIL_USE_TLS:
                print("📧 Starting TLS...")
                server.starttls()
            print("📧 Logging in...")
            server.login(EMAIL_USER, EMAIL_PASS)
            print("📧 Sending email...")
            server.send_message(msg)

        print(f"✅ Email sent to {to_email}")
        return True

    except Exception as e:
        print(f"❌ FAILED to send email to {to_email}")
        print(f"❌ Error details: {type(e).__name__}: {e}")
        return False


@app.route('/api/test-email', methods=['GET'])
def test_email():
    """Test endpoint to verify email is working"""
    try:
        test_email = EMAIL_USER  # Send to yourself

        if not test_email:
            return jsonify({
                'error': 'No test email configured',
                'suggestion': 'Set EMAIL_USER in .env to your email'
            }), 400

        success = send_email(
            test_email,
            "✅ DH-Commerce Email Test",
            f"""
            <h2>🎉 Congratulations!</h2>
            <p>Your DH-Commerce email system is working perfectly!</p>
            <p><strong>Timestamp:</strong> {datetime.now().isoformat()}</p>
            <p><strong>Service:</strong> {EMAIL_HOST}</p>
            <p>Now your users will receive welcome emails, trade notifications, and reminders!</p>
            """
        )

        if success:
            return jsonify({
                'success': True,
                'message': 'Test email sent to ' + test_email,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to send test email'
            }), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# SCHEDULED TASKS
# ============================================


def check_trade_reminders():
    """Check for trades happening soon and send reminders"""
    if not db or not SCHEDULER_AVAILABLE:
        return

    try:
        now = datetime.now(timezone)
        one_hour_later = now + timedelta(hours=1)

        # Find accepted trades happening within next hour
        transactions_ref = db.collection('transactions')
        query = transactions_ref.where('status', '==', 'accepted')

        for doc in query.stream():
            trans = doc.to_dict()

            # Parse trade time
            trade_date = trans.get('tradeDate')
            trade_time = trans.get('tradeTime')

            if trade_date and trade_time:
                trade_str = f"{trade_date} {trade_time}"
                trade_dt = datetime.strptime(trade_str, '%Y-%m-%d %H:%M')
                trade_dt = timezone.localize(trade_dt)

                # Check if within next hour and reminder not sent
                if now <= trade_dt <= one_hour_later and not trans.get('reminderSent', False):
                    # Get users
                    buyer_id = trans.get('fromUserId')
                    seller_id = trans.get('toUserId')

                    if buyer_id and seller_id:
                        # Get user emails
                        buyer_ref = db.collection('users').document(buyer_id)
                        seller_ref = db.collection('users').document(seller_id)

                        buyer_doc = buyer_ref.get()
                        seller_doc = seller_ref.get()

                        if buyer_doc.exists and seller_doc.exists:
                            buyer_data = buyer_doc.to_dict()
                            seller_data = seller_doc.to_dict()

                            # Get food details
                            food_ref = db.collection('foods').document(
                                trans.get('offeredFoodId'))
                            food_doc = food_ref.get()

                            if food_doc.exists:
                                food_data = food_doc.to_dict()

                                # Send reminder to buyer
                                send_email(
                                    buyer_data.get('email'),
                                    "Trade Reminder - 1 Hour to Go!",
                                    f"""
                                    <h3>Trade Reminder</h3>
                                    <p>Your trade for <strong>{food_data.get('name')}</strong> is scheduled in 1 hour.</p>
                                    <p><strong>Time:</strong> {trade_time} on {trade_date}</p>
                                    <p><strong>Location:</strong> School cafeteria</p>
                                    <p>Please be on time!</p>
                                    """
                                )

                                # Send reminder to seller
                                send_email(
                                    seller_data.get('email'),
                                    "Trade Reminder - 1 Hour to Go!",
                                    f"""
                                    <h3>Trade Reminder</h3>
                                    <p>Your trade with {buyer_data.get('fullName')} is scheduled in 1 hour.</p>
                                    <p>You're receiving: <strong>{food_data.get('name')}</strong></p>
                                    <p><strong>Time:</strong> {trade_time} on {trade_date}</p>
                                    <p><strong>Location:</strong> School cafeteria</p>
                                    <p>Please be on time!</p>
                                    """
                                )

                                # Mark reminder as sent
                                doc.reference.update({'reminderSent': True})

        print("✅ Reminder check completed")

    except Exception as e:
        print(f"❌ Error in reminder check: {e}")


def check_rating_requests():
    """Check for completed trades and send rating requests"""
    if not db or not SCHEDULER_AVAILABLE:
        return

    try:
        now = datetime.now(timezone)
        twenty_minutes_ago = now - timedelta(minutes=20)

        # Find completed trades 20+ minutes ago
        transactions_ref = db.collection('transactions')
        query = transactions_ref.where('status', '==', 'accepted')

        for doc in query.stream():
            trans = doc.to_dict()

            trade_date = trans.get('tradeDate')
            trade_time = trans.get('tradeTime')

            if trade_date and trade_time:
                trade_str = f"{trade_date} {trade_time}"
                trade_dt = datetime.strptime(trade_str, '%Y-%m-%d %H:%M')
                trade_dt = timezone.localize(trade_dt)

                # Check if trade was 20+ minutes ago
                if trade_dt <= twenty_minutes_ago and not trans.get('ratingSent', False):
                    buyer_id = trans.get('fromUserId')
                    seller_id = trans.get('toUserId')

                    if buyer_id and seller_id:
                        # Get user emails
                        buyer_ref = db.collection('users').document(buyer_id)
                        seller_ref = db.collection('users').document(seller_id)

                        buyer_doc = buyer_ref.get()
                        seller_doc = seller_ref.get()

                        if buyer_doc.exists and seller_doc.exists:
                            buyer_data = buyer_doc.to_dict()
                            seller_data = seller_doc.to_dict()

                            # Send rating request to buyer
                            send_email(
                                buyer_data.get('email'),
                                "Rate Your Trade Experience",
                                f"""
                                <h3>How was your trade with {seller_data.get('fullName')}?</h3>
                                <p>Please rate your experience from 1-5 stars.</p>
                                <p><a href="https://ict-dh-commerce-project.onrender.com/rate/{doc.id}/buyer">Click here to rate</a></p>
                                <p>Your feedback helps build trust in our community!</p>
                                """
                            )

                            # Send rating request to seller
                            send_email(
                                seller_data.get('email'),
                                "Rate Your Trade Experience",
                                f"""
                                <h3>How was your trade with {buyer_data.get('fullName')}?</h3>
                                <p>Please rate your experience from 1-5 stars.</p>
                                <p><a href="https://ict-dh-commerce-project.onrender.com/rate/{doc.id}/seller">Click here to rate</a></p>
                                <p>Your feedback helps build trust in our community!</p>
                                """
                            )

                            # Mark rating as sent
                            doc.reference.update({'ratingSent': True})

        print("✅ Rating request check completed")

    except Exception as e:
        print(f"❌ Error in rating check: {e}")


# Initialize scheduler only if available
scheduler = None
if SCHEDULER_AVAILABLE:
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_trade_reminders, 'interval', minutes=5)
    scheduler.add_job(check_rating_requests, 'interval', minutes=5)
    scheduler.start()

# ============================================
# BASIC API ENDPOINTS
# ============================================


@app.route('/')
def home():
    return jsonify({
        'service': 'DH-Commerce API',
        'version': '1.0',
        'status': 'running',
        'firebase': 'connected' if db else 'disconnected',
        'email': 'configured' if EMAIL_USER and EMAIL_PASS else 'not configured',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/health', methods=['GET'])
def health():
    firebase_status = "connected" if db else "disconnected"
    email_status = "configured" if EMAIL_USER and EMAIL_PASS else "not configured"

    return jsonify({
        'status': 'healthy',
        'firebase': firebase_status,
        'email': email_status,
        'timestamp': datetime.now().isoformat()
    })

# ============================================
# EMAIL ENDPOINTS
# ============================================


@app.route('/api/send_welcome_email', methods=['POST'])
def send_welcome_email():
    """Send welcome email to new user"""
    try:
        data = request.json
        email = data.get('email')
        name = data.get('name', 'User')
        username = data.get('username', '')

        if not email:
            return jsonify({'error': 'Email required'}), 400

        # Send welcome email
        success = send_email(
            email,
            "Welcome to DH-Commerce!",
            f"""
            <h2>Welcome to DH-Commerce, {name}!</h2>
            <p>You've successfully created your account. Start trading food with your classmates!</p>
            <p><strong>Your username:</strong> {username}</p>
            <p><strong>Your email:</strong> {email}</p>
            <p>Remember our rules:</p>
            <ul>
                <li>Barter only - no money exchanges</li>
                <li>Only school-approved foods</li>
                <li>Be respectful to all traders</li>
            </ul>
            <p>Happy trading!</p>
            <p><em>The DH-Commerce Team</em></p>
            """
        )

        if success:
            return jsonify({'success': True, 'message': 'Welcome email sent'})
        else:
            return jsonify({'success': False, 'message': 'Failed to send email'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/send_trade_request', methods=['POST'])
def send_trade_request_email():
    """Send email when someone requests a trade"""
    try:
        data = request.json
        to_email = data.get('to_email')
        from_user = data.get('from_user')
        food_name = data.get('food_name')
        offer_food = data.get('offer_food')
        trade_time = data.get('trade_time')
        trade_date = data.get('trade_date')
        # Default to localhost
        app_url = data.get('app_url', 'https://ict-dh-commerce-project-1.onrender.com')

        if not all([to_email, from_user, food_name]):
            return jsonify({'error': 'Missing required fields'}), 400

        success = send_email(
            to_email,
            "New Trade Request - DH Commerce",
            f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #1d3557;">📬 New Trade Request</h2>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>{from_user}</strong> wants to trade with you!</p>
                        
                        <div style="display: flex; align-items: center; justify-content: space-around; margin: 20px 0;">
                            <div style="text-align: center;">
                                <p><strong>You Give:</strong></p>
                                <p style="font-size: 18px; color: #e63946;">{food_name}</p>
                            </div>
                            <div style="font-size: 24px;">⇄</div>
                            <div style="text-align: center;">
                                <p><strong>You Receive:</strong></p>
                                <p style="font-size: 18px; color: #1d3557;">{offer_food}</p>
                            </div>
                        </div>
                        
                        <p><strong>Trade Time:</strong> {trade_time} on {trade_date}</p>
                        <p><strong>Location:</strong> School Cafeteria</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{app_url}" 
                           style="background: #1d3557; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; font-weight: bold;
                                  display: inline-block;">
                            Go to DH-Commerce to Respond
                        </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #666; text-align: center;">
                        This is an automated message from DH-Commerce School Food Trading System
                    </p>
                </div>
            </body>
            </html>
            """
        )

        return jsonify({'success': success})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/send_trade_accepted', methods=['POST'])
def send_trade_accepted_email():
    """Send email when trade is accepted"""
    try:
        data = request.json
        to_email = data.get('to_email')
        from_user = data.get('from_user')
        food_name = data.get('food_name')
        trade_time = data.get('trade_time')
        trade_date = data.get('trade_date')

        success = send_email(
            to_email,
            "Trade Accepted!",
            f"""
            <h3>Good News!</h3>
            <p>{from_user} has accepted your trade request.</p>
            <p><strong>You'll receive:</strong> {food_name}</p>
            <p><strong>Trade Time:</strong> {trade_time} on {trade_date}</p>
            <p><strong>Location:</strong> School cafeteria</p>
            <p>Don't forget to show up on time!</p>
            """
        )

        return jsonify({'success': success})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# RATING ENDPOINT (called from email link)
# ============================================


@app.route('/rate/<transaction_id>/<role>', methods=['GET', 'POST'])
def rate_transaction(transaction_id, role):
    """Handle rating submissions from email links"""
    try:
        if request.method == 'GET':
            # Show rating form
            return f"""
            <html>
            <head>
                <title>Rate Your Trade - DH-Commerce</title>
                <style>
                    body {{ font-family: Arial, sans-serif; padding: 40px; max-width: 500px; margin: 0 auto; }}
                    .container {{ background: #f5f5f5; padding: 30px; border-radius: 10px; }}
                    select, textarea {{ width: 100%; padding: 10px; margin: 10px 0; }}
                    button {{ background: #1d3557; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Rate Your Trade Experience</h2>
                    <form method="POST">
                        <label>Rating (1-5 stars):</label><br>
                        <select name="rating">
                            <option value="5">★★★★★ - Excellent</option>
                            <option value="4">★★★★☆ - Good</option>
                            <option value="3">★★★☆☆ - Average</option>
                            <option value="2">★★☆☆☆ - Poor</option>
                            <option value="1">★☆☆☆☆ - Very Poor</option>
                        </select>
                        
                        <label>Comment (optional):</label><br>
                        <textarea name="comment" rows="4" placeholder="How was your trading experience?"></textarea>
                        
                        <button type="submit">Submit Rating</button>
                    </form>
                </div>
            </body>
            </html>
            """

        elif request.method == 'POST':
            # Process rating
            rating = int(request.form.get('rating'))
            comment = request.form.get('comment', '')

            # Get transaction
            if not db:
                return "Database error", 500

            transaction_ref = db.collection(
                'transactions').document(transaction_id)
            transaction_doc = transaction_ref.get()

            if not transaction_doc.exists:
                return "Transaction not found", 404

            trans = transaction_doc.to_dict()

            # Determine who is being rated
            if role == 'buyer':
                rated_user_id = trans.get('toUserId')  # Seller
                rater_user_id = trans.get('fromUserId')  # Buyer
            else:  # seller
                rated_user_id = trans.get('fromUserId')  # Buyer
                rater_user_id = trans.get('toUserId')  # Seller

            # Add rating to database
            rating_ref = db.collection('ratings').document()
            rating_ref.set({
                'fromUserId': rater_user_id,
                'toUserId': rated_user_id,
                'transactionId': transaction_id,
                'rating': rating,
                'comment': comment,
                'createdAt': datetime.now().isoformat()
            })

            # Update user's rating stats
            user_ref = db.collection('users').document(rated_user_id)
            user_doc = user_ref.get()

            if user_doc.exists:
                user_data = user_doc.to_dict()
                current_total = user_data.get('totalRating', 0)
                current_count = user_data.get('ratingCount', 0)

                new_total = current_total + rating
                new_count = current_count + 1
                new_average = new_total / new_count

                user_ref.update({
                    'totalRating': new_total,
                    'ratingCount': new_count,
                    'averageRating': new_average
                })

            return """
            <html>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                <h2>Thank You!</h2>
                <p>Your rating has been submitted successfully.</p>
                <p><em>Your feedback helps improve our trading community.</em></p>
                <p><a href="https://ict-dh-commerce-project-1.onrender.com">Return to DH-Commerce</a></p>
            </body>
            </html>
            """

    except Exception as e:
        return f"Error: {str(e)}", 400

# ============================================
# ADMIN ENDPOINTS (Food Management)
# ============================================


@app.route('/api/admin/foods', methods=['GET', 'POST', 'PUT', 'DELETE'])
def admin_foods():
    """Admin endpoint for food management"""
    try:
        if not db:
            return jsonify({'error': 'Database not connected'}), 500

        # Check admin authentication (in production, use Firebase Auth)
        admin_token = request.headers.get('Authorization')
        # Simple admin check - in production, verify Firebase token
        is_admin = admin_token == 'admin-secret-key'  # Change this in production

        if not is_admin:
            return jsonify({'error': 'Unauthorized'}), 401

        if request.method == 'GET':
            # Get all foods
            foods_ref = db.collection('foods')
            docs = foods_ref.stream()
            foods = []
            for doc in docs:
                food_data = doc.to_dict()
                food_data['id'] = doc.id
                foods.append(food_data)

            return jsonify({
                'success': True,
                'count': len(foods),
                'foods': foods
            })

        elif request.method == 'POST':
            # Add new food
            data = request.json
            required_fields = ['name', 'calories', 'mealType']
            for field in required_fields:
                if field not in data:
                    return jsonify({'error': f'Missing required field: {field}'}), 400

            # Set default values
            food_data = {
                'name': data['name'],
                'calories': int(data['calories']),
                'protein': int(data.get('protein', 0)),
                'carbs': int(data.get('carbs', 0)),
                'fat': int(data.get('fat', 0)),
                'mealType': data['mealType'],
                'availableDate': data.get('availableDate', datetime.now().strftime('%Y-%m-%d')),
                'availableTime': data.get('availableTime', '12:00'),
                'allergyWarnings': data.get('allergyWarnings', ['none']),
                'nutrientsImportance': data.get('nutrientsImportance', 'Provides essential nutrients'),
                'createdAt': datetime.now().isoformat(),
                'updatedAt': datetime.now().isoformat()
            }

            doc_ref = db.collection('foods').document()
            doc_ref.set(food_data)

            return jsonify({
                'success': True,
                'message': 'Food added successfully',
                'foodId': doc_ref.id,
                'food': food_data
            })

        elif request.method == 'PUT':
            # Update food
            data = request.json
            food_id = data.get('id')
            if not food_id:
                return jsonify({'error': 'Food ID required'}), 400

            doc_ref = db.collection('foods').document(food_id)
            if not doc_ref.get().exists:
                return jsonify({'error': 'Food not found'}), 404

            update_data = data.get('data', {})
            update_data['updatedAt'] = datetime.now().isoformat()

            doc_ref.update(update_data)

            return jsonify({
                'success': True,
                'message': 'Food updated successfully'
            })

        elif request.method == 'DELETE':
            # Delete food
            data = request.json
            food_id = data.get('id')
            if not food_id:
                return jsonify({'error': 'Food ID required'}), 400

            doc_ref = db.collection('foods').document(food_id)
            if not doc_ref.get().exists:
                return jsonify({'error': 'Food not found'}), 404

            doc_ref.delete()

            return jsonify({
                'success': True,
                'message': 'Food deleted successfully'
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/check', methods=['GET'])
def admin_check():
    """Check if user is admin"""
    try:
        user_id = request.args.get('userId')
        if not user_id or not db:
            return jsonify({'isAdmin': False})

        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()

        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('isAdmin', False)
            return jsonify({'isAdmin': is_admin})

        return jsonify({'isAdmin': False})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/foods', methods=['GET'])
def get_foods():
    try:
        if not db:
            return jsonify({'error': 'Database not connected'}), 500

        foods_ref = db.collection('foods')

        # Apply filters
        meal_type = request.args.get('mealType')
        if meal_type:
            foods_ref = foods_ref.where('mealType', '==', meal_type)

        docs = foods_ref.stream()

        foods = []
        for doc in docs:
            food_data = doc.to_dict()
            food_data['id'] = doc.id
            foods.append(food_data)

        return jsonify({
            'success': True,
            'count': len(foods),
            'foods': foods
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/init_foods', methods=['POST'])
def init_sample_foods():
    try:
        if not db:
            return jsonify({'error': 'Firebase not connected'}), 500

        # Check if foods already exist
        existing_foods = list(db.collection('foods').limit(1).stream())
        if existing_foods:
            return jsonify({
                'success': False,
                'message': 'Foods already exist in database'
            })

        # Sample foods
        sample_foods = [
            {
                'name': 'Grilled Chicken Sandwich',
                'calories': 350,
                'protein': 25,
                'carbs': 30,
                'fat': 12,
                'mealType': 'lunch',
                'availableDate': '2025-03-20',
                'availableTime': '12:30',
                'allergyWarnings': ['none'],
                'nutrientsImportance': 'High protein for muscle repair',
                'createdAt': datetime.now().isoformat()
            },
            {
                'name': 'Greek Yogurt Parfait',
                'calories': 280,
                'protein': 15,
                'carbs': 45,
                'fat': 8,
                'mealType': 'breakfast',
                'availableDate': '2025-03-20',
                'availableTime': '08:00',
                'allergyWarnings': ['dairy'],
                'nutrientsImportance': 'Calcium for bone health',
                'createdAt': datetime.now().isoformat()
            },
            {
                'name': 'Vegetable Stir Fry',
                'calories': 320,
                'protein': 12,
                'carbs': 40,
                'fat': 10,
                'mealType': 'dinner',
                'availableDate': '2025-03-20',
                'availableTime': '18:00',
                'allergyWarnings': ['soy'],
                'nutrientsImportance': 'Rich in vitamins and fiber',
                'createdAt': datetime.now().isoformat()
            }
        ]

        # Add to Firestore
        batch = db.batch()
        for food in sample_foods:
            doc_ref = db.collection('foods').document()
            batch.set(doc_ref, food)

        batch.commit()

        return jsonify({
            'success': True,
            'message': f'Added {len(sample_foods)} sample foods'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# TRADE HISTORY ENDPOINT
# ============================================


@app.route('/api/trade-history/<user_id>', methods=['GET'])
def get_trade_history(user_id):
    """Get complete trade history for a user"""
    try:
        if not db:
            return jsonify({'error': 'Database not connected'}), 500

        # Get all transactions where user is involved
        sent_transactions = db.collection('transactions').where(
            'fromUserId', '==', user_id).stream()
        received_transactions = db.collection('transactions').where(
            'toUserId', '==', user_id).stream()

        trade_history = []

        # Process sent transactions
        for doc in sent_transactions:
            trans = doc.to_dict()
            trans['id'] = doc.id
            trans['direction'] = 'sent'
            trade_history.append(trans)

        # Process received transactions
        for doc in received_transactions:
            trans = doc.to_dict()
            trans['id'] = doc.id
            trans['direction'] = 'received'
            trade_history.append(trans)

        # Sort by date (newest first)
        trade_history.sort(key=lambda x: x.get('createdAt', ''), reverse=True)

        # Get food details for each trade
        for trade in trade_history:
            # Get offered food
            if 'offeredFoodId' in trade:
                food_doc = db.collection('foods').document(
                    trade['offeredFoodId']).get()
                if food_doc.exists:
                    trade['offeredFood'] = food_doc.to_dict()

            # Get requested food
            if 'requestedFoodId' in trade and trade['requestedFoodId'] != 'all':
                food_doc = db.collection('foods').document(
                    trade['requestedFoodId']).get()
                if food_doc.exists:
                    trade['requestedFood'] = food_doc.to_dict()

            # Get user details
            if trade['direction'] == 'sent':
                user_doc = db.collection('users').document(
                    trade['toUserId']).get()
                if user_doc.exists:
                    trade['otherUser'] = user_doc.to_dict().get('fullName')
            else:
                user_doc = db.collection('users').document(
                    trade['fromUserId']).get()
                if user_doc.exists:
                    trade['otherUser'] = user_doc.to_dict().get('fullName')

        return jsonify({
            'success': True,
            'count': len(trade_history),
            'history': trade_history
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# START THE SERVER
# ============================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))

    print("\n" + "="*60)
    print("🚀 DH-COMMERCE BACKEND WITH EMAIL SYSTEM")
    print("="*60)
    print(f"📡 Local URL: http://localhost:{port}")
    print(f"📡 API Health: http://localhost:{port}/api/health")
    print(f"📡 Test Email: http://localhost:{port}/api/test-email")

    if EMAIL_USER and EMAIL_PASS:
        print("📧 Email: ✅ Configured")
    else:
        print("📧 Email: ⚠️ Not configured (set EMAIL_USER and EMAIL_PASS in .env)")

    print("\n🔧 Required packages (install with pip):")
    print("  pip install flask flask-cors firebase-admin python-dotenv apscheduler pytz")
    print("\n📋 EMAIL ENDPOINTS:")
    print("  GET  /api/test-email           - Test email system")
    print("  POST /api/send_welcome_email   - Welcome email")
    print("  POST /api/send_trade_request   - Trade request notification")
    print("  POST /api/send_trade_accepted  - Trade acceptance notification")
    print("\n📋 ADMIN ENDPOINTS:")
    print("  GET    /api/admin/foods        - Get all foods (admin only)")
    print("  POST   /api/admin/foods        - Add new food (admin only)")
    print("  PUT    /api/admin/foods        - Update food (admin only)")
    print("  DELETE /api/admin/foods        - Delete food (admin only)")
    print("  GET    /api/admin/check        - Check if user is admin")
    print("\n📋 DATA ENDPOINTS:")
    print("  GET  /api/foods                - Get all foods")
    print("  GET  /api/trade-history/<id>   - Get user trade history")
    print("  POST /api/init_foods           - Initialize sample data")
    print("\n⏰ SCHEDULED TASKS:")
    print("  Trade reminders - Every 5 minutes")
    print("  Rating requests - Every 5 minutes")
    print("="*60)
    print("🔄 Starting server... (Press Ctrl+C to stop)")
    print("="*60 + "\n")

    app.run(host='0.0.0.0', port=port, debug=True)
