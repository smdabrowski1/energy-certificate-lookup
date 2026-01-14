from flask import Flask, jsonify, request
from flask_cors import CORS
import duckdb

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Connect to the database
conn = duckdb.connect('energy_project.duckdb', read_only=True)

@app.route('/api/search', methods=['GET'])
def search_addresses():
    """Get all addresses for a given postcode"""
    postcode = request.args.get('postcode', '').strip().upper().replace(' ', '')
    
    if not postcode:
        return jsonify({'error': 'Postcode is required'}), 400
    
    try:
        query = """
            SELECT Address 
            FROM certificates_deduped
            WHERE Postcode = ? 
            ORDER BY 
                CAST(REGEXP_EXTRACT(Address, '^([0-9]+)', 1) AS INTEGER) NULLS LAST,
                Address
        """
        result = conn.execute(query, [postcode]).fetchall()
        addresses = [row[0] for row in result]
        
        return jsonify({
            'postcode': postcode,
            'addresses': addresses,
            'count': len(addresses)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/rating', methods=['GET'])
def get_rating():
    """Get energy rating and recommendations for a specific address and postcode"""
    postcode = request.args.get('postcode', '').strip().upper().replace(' ', '')
    address = request.args.get('address', '').strip()
    
    if not postcode or not address:
        return jsonify({'error': 'Both postcode and address are required'}), 400
    
    try:
        print(f"Searching for: postcode='{postcode}', address='{address}'")
        
        # Get basic rating info
        query = """
            SELECT 
                CURRENT_ENERGY_RATING,
                POTENTIAL_ENERGY_RATING,
                CURRENT_ENERGY_EFFICIENCY,
                POTENTIAL_ENERGY_EFFICIENCY,
                LODGEMENT_DATE
            FROM certificates_deduped
            WHERE POSTCODE = ? AND ADDRESS = ?
        """
        result = conn.execute(query, [postcode, address]).fetchone()
        print(f"📊 Rating result: {result}")

        if not result:
            return jsonify({'error': 'No rating found for this address'}), 404
        
        # Get recommendations
        rec_query = """
            SELECT 
                Improvement_DESCR_TEXT,
                Indicative_Cost
            FROM certificates_deduped_recommendations
            WHERE POSTCODE = ? AND ADDRESS = ?
            AND Improvement_DESCR_TEXT IS NOT NULL
            ORDER BY Indicative_Cost
        """
        rec_results = conn.execute(rec_query, [postcode, address]).fetchall()
        print(f"💡 Found {len(rec_results)} recommendations")
        
        recommendations = [
            {
                'description': row[0],
                'cost': row[1] if row[1] else 'Cost not available'
            }
            for row in rec_results
        ]

        return jsonify({
            'postcode': postcode,
            'address': address,
            'rating': result[0],
            'potential_rating': result[1],
            'current_efficiency': result[2],
            'potential_efficiency': result[3],
            'lodgement_date': result[4],
            'recommendations': recommendations
        })
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        conn.execute("SELECT 1").fetchone()
        return jsonify({'status': 'healthy', 'database': 'connected'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/upload_db', methods=['POST'])
def upload_db():
    """TEMPORARY: Upload database file - REMOVE AFTER USE"""
    import os
    
    if 'database' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['database']
    db_path = 'energy_project_3.duckdb'
    file.save(db_path)
    
    size_mb = os.path.getsize(db_path) / (1024 * 1024)
    return jsonify({'success': True, 'message': f'Database uploaded ({size_mb:.2f} MB)'})


if __name__ == '__main__':
    import os
    import socket
    
    # Get port from environment variable (Railway) or use 5000 (local)
    port = int(os.environ.get('PORT', 5000))
    is_production = os.environ.get('RAILWAY_ENVIRONMENT') is not None
    
    if not is_production:
        # Local development - show helpful info
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        
        print("🚀 Starting Energy Certificate API server...")
        print("📊 Database: energy_project_3.duckdb")
        print(f"🌐 Server running on:")
        print(f"   Local:   http://localhost:{port}")
        print(f"   Network: http://{local_ip}:{port}")
        print("\nAvailable endpoints:")
        print("  GET /api/search?postcode=DN12%202DJ")
        print("  GET /api/rating?postcode=DN12%202DJ&address=1,%20Windmill%20Avenue")
        print("  GET /api/health")
        print("\n📱 Access from your phone using the Network URL above!")
    else:
        print("🚀 Starting in production mode on Railway...")
        print(f"📊 Port: {port}")
    
    # In production, gunicorn handles this, but for local dev:
    app.run(debug=not is_production, host='0.0.0.0', port=port)