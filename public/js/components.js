const components = {
    formatMarkdown: (text) => {
        // Simple markdown-to-html converter simulation for professional look
        return text
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/# (.*)/g, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }
};