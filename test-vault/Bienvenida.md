# Bienvenida

Vault de pruebas de **AgentHub**. Abre la vista lateral con el icono del robot o con el comando
"Abrir AgentHub".

- [[Notas/Proyecto Alfa]]
- [[Notas/Ideas]]

## Ejemplos: Fibonacci en varios lenguajes

Todas las versiones son iterativas (O(n)), salvo Haskell, que usa una lista perezosa infinita.
Cada una imprime los primeros 10 términos:
`0, 1, 1, 2, 3, 5, 8, 13, 21, 34`.

### JavaScript

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

### TypeScript

```ts
function fibonacci(n: number): number {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return a;
}

console.log(Array.from({ length: 10 }, (_, i) => fibonacci(i)));
```

### Python

```python
def fibonacci(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


print([fibonacci(i) for i in range(10)])
```

### Rust

```rust
fn fibonacci(n: u32) -> u64 {
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 0..n {
        (a, b) = (b, a + b);
    }
    a
}

fn main() {
    let seq: Vec<u64> = (0..10).map(fibonacci).collect();
    println!("{:?}", seq);
}
```

### Go

```go
package main

import "fmt"

func fibonacci(n int) int {
	a, b := 0, 1
	for i := 0; i < n; i++ {
		a, b = b, a+b
	}
	return a
}

func main() {
	for i := 0; i < 10; i++ {
		fmt.Print(fibonacci(i), " ")
	}
	fmt.Println()
}
```

### C

```c
#include <stdio.h>

unsigned long long fibonacci(int n) {
    unsigned long long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        unsigned long long t = a + b;
        a = b;
        b = t;
    }
    return a;
}

int main(void) {
    for (int i = 0; i < 10; i++) {
        printf("%llu ", fibonacci(i));
    }
    printf("\n");
    return 0;
}
```

### Java

```java
public class Fibonacci {
    static long fibonacci(int n) {
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) {
            long t = a + b;
            a = b;
            b = t;
        }
        return a;
    }

    public static void main(String[] args) {
        for (int i = 0; i < 10; i++) {
            System.out.print(fibonacci(i) + " ");
        }
        System.out.println();
    }
}
```

### Bash

```bash
fibonacci() {
  local n=$1 a=0 b=1 t
  for ((i = 0; i < n; i++)); do
    t=$((a + b)); a=$b; b=$t
  done
  echo "$a"
}

for i in {0..9}; do printf '%s ' "$(fibonacci "$i")"; done; echo
```

### Haskell

```haskell
fibs :: [Integer]
fibs = 0 : 1 : zipWith (+) fibs (tail fibs)

main :: IO ()
main = print (take 10 fibs)
```

## Ejemplo: Hola mundo en ensamblador

x86-64 para Linux (sintaxis NASM), usando las llamadas al sistema `write` y `exit` directamente.

```nasm
; Ensamblar y enlazar:
;   nasm -f elf64 hola.asm -o hola.o
;   ld hola.o -o hola
;   ./hola

section .data
    msg db "Hola, mundo!", 10   ; 10 = salto de línea
    len equ $ - msg

section .text
    global _start

_start:
    mov rax, 1          ; syscall: write
    mov rdi, 1          ; fd: stdout
    mov rsi, msg        ; buffer
    mov rdx, len        ; longitud
    syscall

    mov rax, 60         ; syscall: exit
    xor rdi, rdi        ; código de salida 0
    syscall
```
