// test_auth.js
// Verification script for Secure Employee Portal API

const API_URL = 'http://localhost:3000';

async function runTests() {
    console.log("=== STARTING AUTHENTICATION & SECURE ACCESS TESTS ===");

    // Test cases variables
    const validEmail = "ks.yadav441@gmail.com";
    const invalidEmail = "unauthorized.user@gmail.com";
    const validPno = "30650145"; // VINOD KUMAR
    const nonExistentPno = "99999999";
    const secondValidEmail = "amishakumar979@gmail.com";
    let debugOtp = null;
    let token = null;

    // 1. Test Unauthorized Email
    try {
        console.log(`\nTest 1: Requesting OTP with unauthorized email: ${invalidEmail}...`);
        const res = await fetch(`${API_URL}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: invalidEmail, pno: validPno })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 403 && data.error.includes("not authorized")) {
            console.log("✅ Test 1 Passed: Unauthorized email rejected with 403.");
        } else {
            console.log("❌ Test 1 Failed.");
        }
    } catch (e) {
        console.error("Test 1 Error:", e);
    }

    // 2. Test Non-existent PNO
    try {
        console.log(`\nTest 2: Requesting OTP with valid email but non-existent PNO: ${nonExistentPno}...`);
        const res = await fetch(`${API_URL}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: validEmail, pno: nonExistentPno })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 404 && data.error.includes("PNO not found")) {
            console.log("✅ Test 2 Passed: Non-existent PNO rejected with 404.");
        } else {
            console.log("❌ Test 2 Failed.");
        }
    } catch (e) {
        console.error("Test 2 Error:", e);
    }

    // 3. Test Valid Credentials & Get OTP (Mock Mode)
    try {
        console.log(`\nTest 3: Requesting OTP with valid credentials (email: ${validEmail}, pno: ${validPno})...`);
        const res = await fetch(`${API_URL}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: validEmail, pno: validPno })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 200 && data.success && data.debugOtp) {
            debugOtp = data.debugOtp;
            console.log(`✅ Test 3 Passed: OTP generated successfully. (OTP: ${debugOtp})`);
        } else {
            console.log("❌ Test 3 Failed.");
        }
    } catch (e) {
        console.error("Test 3 Error:", e);
    }

    // 4. Test Verification with Wrong OTP
    try {
        console.log(`\nTest 4: Verifying with incorrect OTP "000000"...`);
        const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: validEmail, pno: validPno, otp: "000000" })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 400 && data.error.includes("Invalid OTP")) {
            console.log("✅ Test 4 Passed: Wrong OTP rejected.");
        } else {
            console.log("❌ Test 4 Failed.");
        }
    } catch (e) {
        console.error("Test 4 Error:", e);
    }

    // 5. Test Verification with Correct OTP
    try {
        console.log(`\nTest 5: Verifying with correct OTP: ${debugOtp}...`);
        const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: validEmail, pno: validPno, otp: debugOtp })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 200 && data.success && data.token) {
            token = data.token;
            console.log("✅ Test 5 Passed: Verification succeeded and JWT token received.");
        } else {
            console.log("❌ Test 5 Failed.");
        }
    } catch (e) {
        console.error("Test 5 Error:", e);
    }

    // 6. Test Mapping Hijack/Tampering Prevention
    // Try to map another email to the same PNO, or the same email to another PNO.
    try {
        console.log(`\nTest 6: Requesting OTP for a mapped PNO (${validPno}) using a different email (${secondValidEmail})...`);
        const res = await fetch(`${API_URL}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: secondValidEmail, pno: validPno })
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 400 && data.error.includes("already registered to a different email")) {
            console.log("✅ Test 6 Passed: Prevented mapping hijacking of the PNO.");
        } else {
            console.log("❌ Test 6 Failed.");
        }
    } catch (e) {
        console.error("Test 6 Error:", e);
    }

    // 7. Test Accessing Claims without Token
    try {
        console.log("\nTest 7: Fetching claims without Authorization header...");
        const res = await fetch(`${API_URL}/api/employee/my-claims`);
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 401 && data.error.includes("No token provided")) {
            console.log("✅ Test 7 Passed: Rejected unauthenticated request.");
        } else {
            console.log("❌ Test 7 Failed.");
        }
    } catch (e) {
        console.error("Test 7 Error:", e);
    }

    // 8. Test Accessing Claims with Invalid Token
    try {
        console.log("\nTest 8: Fetching claims with invalid/tampered token...");
        const res = await fetch(`${API_URL}/api/employee/my-claims`, {
            headers: { 'Authorization': 'Bearer invalid_token_value_here' }
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Response:`, data);
        if (res.status === 401 && data.error.includes("Invalid or expired session token")) {
            console.log("✅ Test 8 Passed: Rejected invalid token.");
        } else {
            console.log("❌ Test 8 Failed.");
        }
    } catch (e) {
        console.error("Test 8 Error:", e);
    }

    // 9. Test Accessing Claims with Valid Token
    try {
        console.log("\nTest 9: Fetching claims with valid JWT token...");
        const res = await fetch(`${API_URL}/api/employee/my-claims`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(`Claims Count: ${data.claims ? data.claims.length : 0}`);
        if (res.status === 200 && data.success && data.pno === validPno) {
            console.log("✅ Test 9 Passed: Successfully fetched claims matching only this PNO.");
            console.log("Sample claim:", data.claims[0]);
        } else {
            console.log("❌ Test 9 Failed.");
        }
    } catch (e) {
        console.error("Test 9 Error:", e);
    }

    console.log("\n=== AUTHENTICATION & SECURE ACCESS TESTS COMPLETED ===");
}

runTests();
