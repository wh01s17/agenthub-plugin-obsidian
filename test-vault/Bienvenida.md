# Bienvenida

Vault de pruebas de **AgentHub**. Abre la vista lateral con el icono del robot o con el comando
"Abrir AgentHub".

- [[Notas/Proyecto Alfa]]
- [[Notas/Ideas]]

## Ejemplo: Fibonacci en JavaScript

```js
// Devuelve el n-ésimo número de Fibonacci (iterativo, O(n)).
function fibonacci(n) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return a;
}

console.log(Array.from({ length: 10 }, (_, i) => fibonacci(i)));
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```
