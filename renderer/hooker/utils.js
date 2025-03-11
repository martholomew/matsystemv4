export function regexReplacement(text, pattern, replacement) {
    if (!pattern) return text;
    try {
      const regex = new RegExp(pattern, 'g');
      return text.replace(regex, replacement);
    } catch (error) {
      console.error('Invalid regex:', error);
      return text;
    }
  }
  
  export function regexFiltering(text, pattern) {
    if (!pattern) return text;
    try {
      const regex = new RegExp(pattern);
      return regex.test(text) ? '' : text;
    } catch (error) {
      console.error('Invalid regex:', error);
      return text;
    }
  }
  
  export function deleteDuplicateLines(text) {
    return text.replace(/(.+?)\1+/g, '$1');
  }
  
  export function deleteDuplicateLetters(text) {
    return text.replace(/(.)\1/g, '$1');
  }

  export function removeFurigana(text) {
    return text.replace(/\[.*?\]/g, '');
  }
  export function removeSpeaker(text) {
    return text.replace(/[^「]*「/g, '「');
  }