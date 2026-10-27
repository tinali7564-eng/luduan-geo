// 设计系统：石墨中性色 + 单一信号色（电光青柠）。通过覆盖调色板统一全站配色。
module.exports = {
  darkMode: 'class',
  content: ['./public/**/*.html', './public/assets/*.js'],
  theme: {
    extend: {
      colors: {
        slate: { 50: '#f6f7f8', 100: '#eceef0', 200: '#d9dce0', 300: '#b7bcc3', 400: '#8b919a', 500: '#666c75', 600: '#474c54', 700: '#2e3238', 800: '#1d2025', 900: '#131519', 950: '#0b0c0f' },
        cyan: { 50: '#fbffe8', 100: '#f4ffc4', 200: '#eaff94', 300: '#dcfd61', 400: '#ccf43d', 500: '#b3dc1f', 600: '#8cb112', 700: '#6a8612', 800: '#536914', 900: '#445614', 950: '#243005' },
        indigo: { 50: '#f1f3ff', 100: '#e4e8ff', 200: '#cdd4ff', 300: '#aab5ff', 400: '#8793fb', 500: '#6c74f2', 600: '#5657e4', 700: '#4744c8', 800: '#3b3aa1', 900: '#34357f', 950: '#1f1f4a' },
        ink: '#08090b',
      },
      fontFamily: {
        sans: ['"Inter Var"', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans CJK SC"', 'sans-serif'],
        mono: ['"JetBrains Mono Var"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        blink: { '50%': { opacity: '0' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { marquee: 'marquee 40s linear infinite', blink: 'blink 1s step-end infinite', rise: 'rise .5s ease-out both' },
    },
  },
  plugins: [],
};
