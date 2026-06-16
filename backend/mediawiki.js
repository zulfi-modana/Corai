/* require("dotenv").config(); */

async function searchIllustration(keyword) {
  try {
   const response = await fetch(
  "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: keyword,
      prop: "imageinfo",
      iiprop: "url|mime",
      format: "json",
      origin: "*",
      gsrlimit: "5",
    })
);

    const data = await response.json();

    if (!data.query || !data.query.pages) {
      return [];
    }

    const pages = Object.values(data.query.pages);

return pages
  .filter((page) => {
    const info = page.imageinfo?.[0];

    return (
      info &&
      info.url &&
      info.mime &&
      info.mime.startsWith("image/")
    );
  })
  .map((page) => ({
    title: page.title,
    imageUrl: page.imageinfo[0].url,
    mime: page.imageinfo[0].mime,
  }));
  } catch (err) {
    console.error("MediaWiki Error:", err);
    return [];
  }
}

module.exports = {
  searchIllustration,
};