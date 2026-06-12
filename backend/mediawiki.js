async function searchIllustration(keyword) {
  try {
    const response = await fetch(
      "https://commons.wikimedia.org/w/api.php?action=query" +
        "&generator=search" +
        "&gsrnamespace=6" +
        "&gsrsearch=" +
        encodeURIComponent(keyword) +
        "&prop=imageinfo" +
        "&iiprop=url" +
        "&format=json" +
        "&origin=*"
    );

    const data = await response.json();

    if (!data.query || !data.query.pages) {
      return [];
    }

    const pages = Object.values(data.query.pages);

    return pages.map((page) => ({
      title: page.title,
      imageUrl:
        page.imageinfo && page.imageinfo[0]
          ? page.imageinfo[0].url
          : null,
    }));
  } catch (err) {
    console.error("MediaWiki Error:", err);
    return [];
  }
}

module.exports = {
  searchIllustration,
};