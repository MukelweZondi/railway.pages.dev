```javascript
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { items, delivery } = JSON.parse(event.body || "{}");

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Your bag is empty." }),
      };
    }

    // Prices are in cents: 50000 = R500.00.
    // Only these server-approved products can be purchased.
    const allowedProducts = {
      "railway-01": { name: "RAILWAY Essential Tee 01", price: 50000 },
      "railway-02": { name: "RAILWAY Essential Tee 02", price: 50000 },
      "railway-03": { name: "RAILWAY Essential Tee 03", price: 50000 },
    };

    let total = 0;

    for (const item of items) {
      const product = allowedProducts[item.id];
      const quantity = Number(item.quantity);

      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Invalid product or quantity.",
          }),
        };
      }

      total += product.price * quantity;
    }

    const deliveryFees = {
      standard: 12000,
      collection: 6000,
    };

    if (!Object.hasOwn(deliveryFees, delivery)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Please choose a delivery option.",
        }),
      };
    }

    total += deliveryFees[delivery];

    if (total < 200) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid payment amount." }),
      };
    }

    const secretKey = process.env.YOCO_SECRET_KEY;

    if (!secretKey) {
      console.error("YOCO_SECRET_KEY is not configured.");

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Payment setup is incomplete. Please try again later.",
        }),
      };
    }

    // Use your deployed website's HTTPS address for redirects.
    const baseUrl = "https://" + event.headers.host;

    const checkoutResponse = await fetch(
      "https://payments.yoco.com/api/checkouts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          currency: "ZAR",
          successUrl: `${baseUrl}/?payment=success`,
          cancelUrl: `${baseUrl}/?payment=cancelled`,
          failureUrl: `${baseUrl}/?payment=failed`,
          metadata: {
            store: "RAILWAY",
          },
        }),
      }
    );

    const checkout = await checkoutResponse.json();

    if (!checkoutResponse.ok || !checkout.redirectUrl) {
      console.error(
        "Yoco checkout creation failed with status:",
        checkoutResponse.status
      );

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Could not start payment. Please try again.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        redirectUrl: checkout.redirectUrl,
      }),
    };
  } catch (error) {
    console.error("Checkout function error:", error.message);

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Unable to process checkout. Please try again.",
      }),
    };
  }
};
