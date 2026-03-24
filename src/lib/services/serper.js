// ============================================
// SERPER API
// ============================================
// Searches Google via Serper.dev for real products and companies.
// Returns: title, URL, snippet.

export async function searchSerper(query) {
  try {
    if (!process.env.SERPER_API_KEY) {
      console.error("No Serper API key configured");
      return [];
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 5,
      }),
    });

    if (!response.ok) {
      console.error("Serper API error:", response.status);
      return [];
    }

    const data = await response.json();

    return (data.organic || []).slice(0, 5).map((result) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet || "",
      source: "google",
    }));
  } catch (error) {
    console.error("Serper search failed:", error);
    return [];
  }
}