import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

async function testRefreshHardening() {
    console.log('--- Starting Refresh Token Hardening Verification ---');

    try {
        const email = `refresh_test_${Date.now()}@example.com`;
        const password = 'Password123';

        // 1. Register & Login
        console.log('\n1. Getting initial tokens...');
        await axios.post(`${API_URL}/auth/register`, { email, password });
        const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
        let { access_token, refresh_token } = loginRes.data.data;
        console.log('✅ Tokens received');

        // 2. Verify Access Token Type (Protect route)
        console.log('\n2. Verifying access token works on protected route...');
        await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        console.log('✅ Access token accepted');

        // 3. Prevent Refresh Token for Access
        console.log('\n3. Testing refresh token for access (Should fail 401)...');
        try {
            await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${refresh_token}` }
            });
            console.error('❌ ERROR: Refresh token was accepted as access token');
        } catch (err) {
            console.log('✅ Correctly rejected refresh token for access');
        }

        // 4. Test Rotation
        console.log('\n4. Testing token rotation...');
        const refreshRes = await axios.post(`${API_URL}/auth/refresh`, { refresh_token });
        const new_access = refreshRes.data.data.access_token;
        const new_refresh = refreshRes.data.data.refresh_token;

        if (new_refresh && new_refresh !== refresh_token) {
            console.log('✅ Token rotation successful (New refresh token issued)');
        } else {
            console.error('❌ ERROR: New refresh token NOT issued or same as old');
        }

        // 5. Test Access Token for Refresh
        console.log('\n5. Testing access token on refresh endpoint (Should fail 401)...');
        try {
            await axios.post(`${API_URL}/auth/refresh`, { refresh_token: access_token });
            console.error('❌ ERROR: Access token was accepted for refresh');
        } catch (err) {
            console.log('✅ Correctly rejected access token for refresh');
        }

        // 6. Test Refresh Rate Limiting
        console.log('\n6. Testing refresh rate limiting (10 attempts)...');
        let blocked = false;
        for (let i = 0; i < 15; i++) {
            try {
                await axios.post(`${API_URL}/auth/refresh`, { refresh_token: new_refresh });
            } catch (err) {
                if (err.response?.status === 429) {
                    blocked = true;
                    console.log(`✅ Rate limited at attempt ${i + 1}`);
                    break;
                }
            }
        }
        if (!blocked) {
            console.warn('⚠️ WARNING: Refresh rate limiting did not trigger within 15 attempts');
        }

        console.log('\n--- Refresh Hardening Verification Complete ---');

    } catch (err) {
        console.error('❌ Test failed:', err.response?.data || err.message);
        process.exit(1);
    }
}

testRefreshHardening();
