const isManager = true;
const html = `
  ${isManager ? `
    ${(() => {
      const a = 1;
      return `${a}`;
    })()}
  ` : ''}
`;
console.log(html);
