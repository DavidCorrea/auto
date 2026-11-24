(function () {
  function getTimePeriod(hour) {
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'noon';
    if (hour >= 17 && hour < 21) return 'dusk';
    return 'night';
  }

  function applyTimeTheme(period) {
    const root = document.documentElement;
    const isDark = root.dataset.theme === 'dark';

    const themes = {
      dawn: {
        light: {
          '--site-bg': '#fef8f0',
          '--site-text': '#3d2f1f',
          '--site-muted': '#a68a6b',
          '--site-border': '#e8d4b9',
          '--site-accent': '#e8a87c',
          '--site-mark-bg': '#fff5e6',
          '--site-track': '#3d2f1f'
        },
        dark: {
          '--site-bg': '#2d1f12',
          '--site-text': '#f5e6d3',
          '--site-muted': '#a68a6b',
          '--site-border': '#4a3620',
          '--site-accent': '#e8a87c',
          '--site-mark-bg': '#3d2f1f',
          '--site-track': '#f5e6d3'
        }
      },
      noon: {
        light: {
          '--site-bg': '#f0f8ff',
          '--site-text': '#1a3a4a',
          '--site-muted': '#6b9bb8',
          '--site-border': '#b8d4e8',
          '--site-accent': '#4a90d9',
          '--site-mark-bg': '#e6f0fa',
          '--site-track': '#1a3a4a'
        },
        dark: {
          '--site-bg': '#0d1f2a',
          '--site-text': '#cfe8f5',
          '--site-muted': '#6b9bb8',
          '--site-border': '#1e3a4a',
          '--site-accent': '#7ab8f0',
          '--site-mark-bg': '#152a3a',
          '--site-track': '#cfe8f5'
        }
      },
      dusk: {
        light: {
          '--site-bg': '#fff0e6',
          '--site-text': '#4a2c1a',
          '--site-muted': '#c48a6b',
          '--site-border': '#e8c4a0',
          '--site-accent': '#d47a3a',
          '--site-mark-bg': '#fff5e6',
          '--site-track': '#4a2c1a'
        },
        dark: {
          '--site-bg': '#2d1a0f',
          '--site-text': '#f5e0d0',
          '--site-muted': '#c48a6b',
          '--site-border': '#4a2c1a',
          '--site-accent': '#e89050',
          '--site-mark-bg': '#3d2515',
          '--site-track': '#f5e0d0'
        }
      },
      night: {
        light: {
          '--site-bg': '#1a1a2e',
          '--site-text': '#e8e8f0',
          '--site-muted': '#8a8ab8',
          '--site-border': '#3a3a5a',
          '--site-accent': '#8a8aff',
          '--site-mark-bg': '#252540',
          '--site-track': '#e8e8f0'
        },
        dark: {
          '--site-bg': '#0a0a15',
          '--site-text': '#d0d0e0',
          '--site-muted': '#707090',
          '--site-border': '#25253a',
          '--site-accent': '#a0a0ff',
          '--site-mark-bg': '#121220',
          '--site-track': '#d0d0e0'
        }
      }
    };

    const theme = themes[period][isDark ? 'dark' : 'light'];
    Object.entries(theme).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });

    root.dataset.timePeriod = period;
  }

  function init() {
    const hour = new Date().getHours();
    const period = getTimePeriod(hour);
    applyTimeTheme(period);

    // Update at midnight boundaries
    const now = new Date();
    const nextChange = new Date(now);
    if (hour < 5) nextChange.setHours(5, 0, 0, 0);
    else if (hour < 9) nextChange.setHours(9, 0, 0, 0);
    else if (hour < 17) nextChange.setHours(17, 0, 0, 0);
    else if (hour < 21) nextChange.setHours(21, 0, 0, 0);
    else nextChange.setDate(nextChange.getDate() + 1), nextChange.setHours(5, 0, 0, 0);

    const msUntilNext = nextChange - now;
    setTimeout(() => {
      init(); // recalculate and set up next interval
      setInterval(init, 24 * 60 * 60 * 1000);
    }, msUntilNext);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();