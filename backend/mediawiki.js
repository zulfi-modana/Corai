require("dotenv").config();

async function searchIllustration(keyword) {
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}` +
      `&q=${encodeURIComponent(keyword)}` +
      `&image_type=illustration` +
      `&per_page=5` +
      `&safesearch=true`
    );

    const data = await response.json();

    if (!data.hits || data.hits.length === 0) {
      return [];
    }

    return data.hits.map((img) => ({
      title: img.tags,
      imageUrl: img.webformatURL,
    }));

  } catch (err) {
    console.error("Pixabay Error:", err);

    return [];
  }
}

module.exports = {
  searchIllustration,
};