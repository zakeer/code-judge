class TestCase {
  constructor(input, output, description = '') {
    this.input = input;
    this.output = output;
    this.description = description;
    this.actualOutput = null;
    this.passed = false;
    this.executionTime = 0;
  }

  setResult(actualOutput, executionTime) {
    this.actualOutput = actualOutput;
    this.executionTime = executionTime;
    // Normalize outputs by trimming whitespace and converting to string
    const normalizedActual = String(actualOutput).trim();
    const normalizedExpected = String(this.output).trim();
    this.passed = normalizedActual === normalizedExpected;
  }

  toJSON() {
    return {
      input: this.input,
      output: this.output,
      description: this.description,
      actualOutput: this.actualOutput,
      passed: this.passed,
      executionTime: this.executionTime
    };
  }
}

module.exports = TestCase;