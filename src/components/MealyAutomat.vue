<template>
  <div>
    <canvas ref="canvas" width="600" height="400" style="border: 1px solid black;"></canvas>
    <button @click="nextState">Next</button>
    <p>Aktueller Zustand: {{ currentState }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { sm } from 'jssm';

interface StatePosition {
  x: number;
  y: number;
}

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const currentState = ref<string>('Red');


const states = {
  Red: { x: 100, y: 200 },
  Green: { x: 300, y: 200 },
  Yellow: { x: 500, y: 200 }
} as const satisfies Record<string, StatePosition>;

const machine = sm`Red 'next' -> Green 'next' -> Yellow 'next' -> Red;`;

const drawState = (name: string, x: number, y: number): void => {
  const context = ctx.value;
  if (!context) return;
  
  context.beginPath();
  context.arc(x, y, 30, 0, 2 * Math.PI);
  context.stroke();
  context.fillText(name, x - 15, y + 5);
  
  if (name === currentState.value) {
    context.strokeStyle = 'red';
    context.lineWidth = 3;
    context.stroke();
    context.strokeStyle = 'black';
    context.lineWidth = 1;
  }
};

const drawArrow = (from: StatePosition, to: StatePosition): void => {
  const context = ctx.value;
  if (!context) return;
  
  const headlen = 10;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  
  context.beginPath();
  context.moveTo(to.x, to.y);
  context.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
  context.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
  context.lineTo(to.x, to.y);
  context.fill();
};

const drawAutomat = (): void => {
  const context = ctx.value;
  if (!context) return;
  
  context.clearRect(0, 0, 600, 400);
  
  Object.entries(states).forEach(([name, pos]) => {
    drawState(name, pos.x, pos.y);
  });
  
  
  drawArrow(states.Red!, states.Green!);
  drawArrow(states.Green!, states.Yellow!);
  drawArrow(states.Yellow!, states.Red!);
};

const nextState = (): void => {
  if (machine.action('next')) {
    currentState.value = machine.state();
  }
};

onMounted(() => {
  if (canvas.value) {
    ctx.value = canvas.value.getContext('2d')!;
    currentState.value = machine.state();
    drawAutomat();
  }
});

watch(currentState, () => {
  drawAutomat();
});
</script>
