// Test script to verify property sorting functionality
const BASE_URL = "http://localhost:3000";

async function testPropertySorting() {
  console.log("🧪 Testing Property Sorting...\n");

  // Clear existing mock data by restarting server or using a different approach
  console.log("1️⃣ Creating test properties with different active states...");

  const testProperties = [
    {
      name: "Inactive Property 1",
      address: "123 Inactive St",
      type: "residential",
      units: 1,
      isActive: false,
    },
    {
      name: "Active Property 1",
      address: "456 Active St",
      type: "residential",
      units: 2,
      isActive: true,
    },
    {
      name: "Inactive Property 2",
      address: "789 Inactive St",
      type: "commercial",
      units: 3,
      isActive: false,
    },
    {
      name: "Active Property 2",
      address: "101 Active St",
      type: "commercial",
      units: 4,
      isActive: true,
    },
    {
      name: "Lot Property",
      address: "202 Lot Blvd",
      type: "lot",
      units: 0,
      isActive: true,
    },
  ];

  // Create properties
  for (const property of testProperties) {
    try {
      const response = await fetch(`${BASE_URL}/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(property),
      });

      const result = await response.json();
      if (result.success) {
        console.log(
          `✅ Created: ${property.name} (Active: ${property.isActive})`
        );
      } else {
        console.log(`❌ Failed to create: ${property.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${property.name}:`, error.message);
    }
  }

  console.log("\n2️⃣ Testing GET /properties sorting...");
  try {
    const response = await fetch(`${BASE_URL}/properties`);
    const result = await response.json();

    if (result.success && result.data) {
      console.log("📋 Properties in order:");
      result.data.forEach((property, index) => {
        const status = property.isActive ? "🟢 Active" : "🔴 Inactive";
        console.log(`${index + 1}. ${property.name} - ${status}`);
      });

      // Verify sorting
      let isCorrectlySorted = true;
      let lastActiveIndex = -1;

      for (let i = 0; i < result.data.length; i++) {
        if (result.data[i].isActive) {
          lastActiveIndex = i;
        } else if (lastActiveIndex !== -1) {
          // Found an inactive property after an active one
          isCorrectlySorted = false;
          break;
        }
      }

      if (isCorrectlySorted) {
        console.log("\n✅ Sorting is correct: Active properties come first!");
      } else {
        console.log(
          "\n❌ Sorting is incorrect: Inactive properties found before active ones"
        );
      }
    } else {
      console.log("❌ Failed to fetch properties");
    }
  } catch (error) {
    console.error("❌ Error fetching properties:", error.message);
  }

  console.log("\n🎉 Sorting test completed!");
}

// Run the test
testPropertySorting();
