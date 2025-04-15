# Code Execution API Examples

## Basic Code Execution

```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function sum(a, b) { return a + b; }\nconsole.log(sum(2, 3));",
    "language": "javascript"
  }'
```

## Code Execution with Test Cases

```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function sum(a, b) { return a + b; }",
    "language": "javascript",
    "testCases": [
      {
        "input": "sum(2, 3)",
        "output": "5",
        "description": "Basic addition test"
      },
      {
        "input": "sum(-1, 1)",
        "output": "0",
        "description": "Test with negative number"
      },
      {
        "input": "sum(0, 0)",
        "output": "0",
        "description": "Test with zeros"
      }
    ]
  }'
```

## Python Example with Input/Output Test Cases

```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n-1)",
    "language": "python",
    "testCases": [
      {
        "input": "factorial(0)",
        "output": "1",
        "description": "Factorial of 0"
      },
      {
        "input": "factorial(5)",
        "output": "120",
        "description": "Factorial of 5"
      }
    ]
  }'
```

## C++ Example with Multiple Test Cases

```bash
curl -X POST http://localhost:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "#include <iostream>\nusing namespace std;\n\nint fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n-1) + fibonacci(n-2);\n}",
    "language": "cpp",
    "testCases": [
      {
        "input": "fibonacci(0)",
        "output": "0",
        "description": "First Fibonacci number"
      },
      {
        "input": "fibonacci(1)",
        "output": "1",
        "description": "Second Fibonacci number"
      },
      {
        "input": "fibonacci(5)",
        "output": "5",
        "description": "6th Fibonacci number"
      }
    ]
  }'
```