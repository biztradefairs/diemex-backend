const axios = require('axios');

const API_BASE = 'http://localhost:5000/api/auth/exhibitor';

async function testAuth() {
  console.log('\n🚀 TESTING EXHIBITOR AUTH SYSTEM\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Test if server is running
    console.log('1. Testing server connection...');
    try {
      const healthCheck = await axios.get('http://localhost:5000/health', { timeout: 5000 });
      console.log('✅ Server is running:', healthCheck.data.status);
    } catch (serverError) {
      console.error('❌ Server is not running or not accessible');
      console.error('   Make sure your backend server is running on port 5000');
      return;
    }
    
    // 2. Test body parsing
    console.log('\n2. Testing body parsing...');
    try {
      const testBody = await axios.post(`${API_BASE}/test-body`, {
        email: 'test@example.com',
        password: 'test123'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Body parsing works');
      console.log('   Response:', testBody.data);
    } catch (bodyError) {
      console.error('❌ Body parsing failed:', bodyError.message);
      if (bodyError.response) {
        console.error('   Response data:', bodyError.response.data);
      }
    }
    
    // 3. Reset password for existing exhibitor
    console.log('\n3. Resetting password for rohan1.maxx@gmail.com...');
    try {
      const resetResult = await axios.post(`${API_BASE}/reset-password`, {
        email: 'rohan1.maxx@gmail.com',
        newPassword: '123456'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Password reset successful');
      console.log('   Response:', resetResult.data);
    } catch (resetError) {
      console.error('❌ Password reset failed:', resetError.message);
      if (resetError.response) {
        console.error('   Response:', resetError.response.data);
      }
    }
    
    // 4. Test login with new password
    console.log('\n4. Testing login with new password...');
    try {
      const loginResult = await axios.post(`${API_BASE}/login`, {
        email: 'rohan1.maxx@gmail.com',
        password: '123456'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Login successful!');
      console.log('   Success:', loginResult.data.success);
      console.log('   Message:', loginResult.data.message);
      if (loginResult.data.data?.token) {
        console.log('   Token received (first 30 chars):', loginResult.data.data.token.substring(0, 30) + '...');
      }
    } catch (loginError) {
      console.error('❌ Login failed:', loginError.message);
      if (loginError.response) {
        console.error('   Response:', loginError.response.data);
      }
    }
    
    // 5. Alternative: Try the direct fix method
    console.log('\n5. Trying direct password fix method...');
    try {
      const fixResult = await axios.post(`${API_BASE}/fix-password-direct`, {
        email: 'rohan1.maxx@gmail.com',
        password: '123456'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Direct fix successful');
      console.log('   Response:', fixResult.data);
      
      // Try login again after direct fix
      console.log('\n6. Testing login after direct fix...');
      const relogin = await axios.post(`${API_BASE}/login`, {
        email: 'rohan1.maxx@gmail.com',
        password: '123456'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Login after direct fix:', relogin.data.success ? 'SUCCESS' : 'FAILED');
      
    } catch (fixError) {
      console.error('❌ Direct fix failed:', fixError.message);
      if (fixError.response) {
        console.error('   Response:', fixError.response.data);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test script error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST COMPLETE');
}

// Run the tests
testAuth();