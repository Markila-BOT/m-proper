// Simple test script for properties endpoint
const BASE_URL = "http://localhost:3000";

async function testPropertiesEndpoint() {
  console.log("🧪 Testing Properties Endpoint...\n");

  // Test 1: Create a property
  console.log("1️⃣ Testing POST /properties");
  try {
    const createResponse = await fetch(`${BASE_URL}/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Property",
        address: "123 Test Street, Test City",
        type: "residential",
        units: 2,
        isActive: true,
      }),
    });

    const createResult = await createResponse.json();
    console.log(
      "✅ Create Property Response:",
      JSON.stringify(createResult, null, 2)
    );
  } catch (error) {
    console.error("❌ Create Property Error:", error.message);
  }

  console.log("\n2️⃣ Testing GET /properties");
  try {
    const getResponse = await fetch(`${BASE_URL}/properties`);
    const getResult = await getResponse.json();
    console.log(
      "✅ Get Properties Response:",
      JSON.stringify(getResult, null, 2)
    );
  } catch (error) {
    console.error("❌ Get Properties Error:", error.message);
  }

  console.log("\n🎉 Test completed!");
}

// Run the test
testPropertiesEndpoint();
