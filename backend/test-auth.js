import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

async function testAuth() {
    console.log('--- Starting Auth Verification ---');

    try {
        const email = `test_${Date.now()}@example.com`;
        const password = 'Password123';

        // 1. Register
        console.log('\n1. Testing Registration...');
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            email,
            password
        });
        console.log('✅ Registration successful');
        console.log('User Role:', regRes.data.data.user.role);

        // 2. Register Duplicate
        console.log('\n2. Testing Duplicate Registration...');
        try {
            await axios.post(`${API_URL}/auth/register`, { email, password });
            console.error('❌ Duplicate registration should have failed');
        } catch (err) {
            console.log('✅ Duplicate registration failed correctly (409)');
        }

        // 3. Login
        console.log('\n3. Testing Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
        });
        console.log('✅ Login successful');
        const { access_token, refresh_token } = loginRes.data.data;

        // 4. Access Protected Route (Me)
        console.log('\n4. Testing Protected Profile Route...');
        const meRes = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        console.log('✅ Identity verified:', meRes.data.data.user.email);

        // 5. Access Protected Runs without token
        console.log('\n5. Testing Route Protection (Missing Token)...');
        try {
            await axios.get(`${API_URL}/runs`);
            console.error('❌ Access without token should have failed');
        } catch (err) {
            console.log('✅ Access without token failed correctly (401)');
        }

        // 6. Access Protected Runs with token
        console.log('\n6. Testing Route Access (With Token)...');
        const runsRes = await axios.get(`${API_URL}/runs`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        console.log('✅ Access with token successful. Runs count:', runsRes.data.data.length);

        // 7. Refresh Token
        console.log('\n7. Testing Token Refresh...');
        const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token
        });
        console.log('✅ Token refresh successful');
        const newAccessToken = refreshRes.data.data.access_token;

        // 8. Access with new token
        console.log('\n8. Testing Access with Refreshed Token...');
        await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${newAccessToken}` }
        });
        console.log('✅ Refreshed token works');

        console.log('\n--- Auth Verification Complete ---');

    } catch (err) {
        console.error('❌ Test failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

testAuth();
