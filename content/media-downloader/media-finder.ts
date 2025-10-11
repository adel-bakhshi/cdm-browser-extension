import type { MediaData } from "./models/media-data";

/**
 * Media finder class for finding media elements in the current page.
 */
export default class MediaFinder {
  /**
   * Finds media elements in the current page.
   * @returns An array of media data objects containing the source and element.
   */
  static findMediaElements() {
    const mediaElements = document.querySelectorAll("video, audio");
    const data: Array<MediaData> = [];

    mediaElements.forEach((element) => {
      if (element.tagName.toLowerCase() === "video" || element.tagName.toLowerCase() === "audio") {
        const source = (element as any).currentSrc;
        data.push({ source, element });

        const sourceElements = element.querySelectorAll("source");
        sourceElements.forEach((sourceElement) => {
          data.push({ source: sourceElement.src, element });
        });
      }
    });

    // Remove duplicates and return the unique media elements
    return [...new Map(data.map((item) => [item.source, item])).values()];
  }
}
