const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');

function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('open');
}

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

document.querySelector('#year').textContent = String(new Date().getFullYear());
