const BACKEND_URL = 'http://localhost:6969/gemini-chat';

async function analyzePokemon(imageUrl) {
    console.log("Firefox Extension: Sending image to local backend:", imageUrl);

    try {
        // Fetch the image from Discord's CDN
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        // Convert to Base64
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });

        // Match your FastAPI GeminiRequest model
        const payload = {
            message: "What is the name of the Pokémon in this image? Respond with only the name.",
            files: [{ mime_type: "image/jpeg", data: base64Data }]
        };

        const res = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("✅ Firefox Ext identified:", data.response);

        // Optional: Send a notification or alert with the name
    } catch (error) {
        console.error("❌ Firefox Extension Error:", error);
    }
}

// Mutation Observer to watch for Pokétwo spawns
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                // Use the specific class from your HTML snippet
                const img = node.querySelector('.imageWrapper_af017a img');
                if (img && img.src && !img.src.includes('data:image')) {
                    analyzePokemon(img.src);
                }
            }
        });
    }
});

// Start observing
const targetNode = document.querySelector('[aria-label="Messages in spam"]') || document.body;
observer.observe(targetNode, { childList: true, subtree: true });
console.log("🚀 Firefox Poketwo Forwarder Active");