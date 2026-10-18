exports.handler = async (event) => {
if (event.httpMethod !== "POST") {
return {
statusCode: 405,
body: JSON.stringify({ error: "Method not allowed" }),
};
}

try {
const { items, customer, delivery, successUrl, cancelUrl } = JSON.parse(event.body || "{}");

```
if (!Array.isArray(items) || items.length === 0) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: "Your bag is empty." }),
  };
}

const allowedProducts = {
  "railway-01": { name: "RAILWAY Essential Tee 01", price: 50000 },
  "railway-02": { name: "RAILWAY Essential Tee 02", price: 50000 },
  "railway-03": { name: "RAILWAY Essential Tee 03", price: 50000 },
};

let total = 0;

for (const item of items) {
  const product = allowedProducts[item.id];
  const quantity = Number(item.quantity);

  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid product or quantity." }),
    };
  }

  total += product.price * quantity;
}

const deliveryFee = delivery === "standard" ? 12000 : delivery === "collection" ? 6000 : null;

if (deliveryFee === null) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: "Please choose a delivery option." }),
  };
}

total += deliveryFee;

const secretKey = process.env.YOCO_SECRET_KEY;
if (!secretKey) {
  return {
    statusCode: 500,
    body: JSON.stringify({ error: "Payment setup is incomplete. Please try again later." }),
  };
}

const baseUrl = `https://${event.headers.host}`;
const checkoutResponse = await fetch("https://payments.yoco.com/api/checkouts", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: total,
    currency: "ZAR",
    successUrl: successUrl || `${baseUrl}/?payment=success`,
    cancelUrl: cancelUrl || `${baseUrl}/?payment=cancelled`,
    failureUrl: `${baseUrl}/?payment=failed`,
    metadata: {
      customerName: String(customer?.name || "").slice(0, 100),
      customerEmail: String(customer?.email || "").slice(0, 200),
      customerPhone: String(customer?.phone || "").slice(0, 50),
    },
  }),
});

const checkout = await checkoutResponse.json();

if (!checkoutResponse.ok || !checkout.redirectUrl) {
  console.error("Yoco checkout creation failed:", checkoutResponse.status);
  return {
    statusCode: 502,
    body: JSON.stringify({ error: "Could not start payment. Please try again." }),
  };
}

return {
  statusCode: 200,
  body: JSON.stringify({ redirectUrl: checkout.redirectUrl }),
};
```

} catch (error) {
console.error("Checkout function error:", error);
return {
statusCode: 400,
body: JSON.stringify({ error: "Unable to process checkout. Please check your order and try again." }),
};
}
};
