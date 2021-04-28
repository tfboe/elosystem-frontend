export default class ParseError extends Error {
    constructor(m: string) {
        super(m);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, ParseError.prototype);
    }
}

export function assert(test: boolean, m: string) {
    if (!test) {
        if (!m) {
            m = "assert failed";
        }
        throw new ParseError(m);
    }
}