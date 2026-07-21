<template>
  <router-view></router-view>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Onest:wght@500;600;700&display=swap');

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: #0e0c16;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  padding: 0;
}

button,
input,
textarea {
  font: inherit;
}

::selection {
  background: #8d5cff;
  color: #fbf9ff;
}
</style>
