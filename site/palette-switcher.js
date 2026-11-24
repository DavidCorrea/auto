window.addEventListener('DOMContentLoaded', function() {
  const button = document.getElementById('palette-switcher');
  if (!button) return;
  const palettes = [
    { name: 'Dawn', color: '#FF6B6B' },
    { name: 'Moss', color: '#2F855A' },
    { name: 'Tide', color: '#2B6CB0' },
    { name: 'Dusk', color: '#805AD5' }
  ];
  let current = localStorage.getItem('site-palette') || 'Dawn';
  function apply() {
    const palette = palettes.find(p => p.name === current) || palettes[0];
    document.documentElement.style.setProperty('--site-accent', palette.color);
    localStorage.setItem('site-palette', palette.name);
    button.textContent = 'Palette: ' + palette.name;
  }
  button.addEventListener('click', function() {
    const idx = palettes.findIndex(p => p.name === current);
    current = palettes[(idx + 1) % palettes.length].name;
    apply();
  });
  apply();
});