import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
canvas.width = 640;
canvas.height = 400;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#1f2a1c';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#e6ecdf';
ctx.font = '16px system-ui';
ctx.fillText('Em breve: um ecossistema inteiro aqui.', 24, 40);
