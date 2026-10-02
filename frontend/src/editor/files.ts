const IMAGE_NAME = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|avif)$/i;

/** Files that look like images. Unsupported image types still go through, so the app can say why they were refused. */
export function imageFiles(list: FileList | readonly File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/') || (file.type === '' && IMAGE_NAME.test(file.name)));
}
