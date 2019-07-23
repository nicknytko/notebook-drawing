define([], function() {
    /**
     * A circular buffer that can store some fixed number of items.
     * Once the size has been exhausted the earliest pushed item will be overwritten.
     */
    class CircularBuffer {
        constructor(numElements) {
            this.max = numElements;
            this.buffer = Array(numElements).fill(null);
            this.start = 0;
            this.end = 0;
        }

        /**
         * Returns how many items are in the buffer.
         */
        get size() {
            return this.end - this.start;
        }

        get length() {
            return this.end - this.start;
        }

        /**
         * Takes the first item off the buffer and returns it.
         */
        pop() {
            if (this.end < this.start) {
                let x = this.buffer[this.end % this.max];
                this.end += 1;
                return x;
            } else {
                return null;
            }
        }

        /**
         * Places some element at the end of the buffer.
         * If the buffer is full, the first element is removed.
         * @param x Element to insert.
         */
        push(x) {
            this.buffer[this.end % this.max] = x;
            this.end += 1;

            if (this.size > this.max) {
                this.start = this.end - this.max;
            }
        }

        /**
         * Gets the element at a certain position in the buffer.
         * @param index Position to grab element from.  This is relative to what is considered the "first" element.  If the index is negative will go relative from the end.
         * @returns the element itself.
         */
        at(index) {
            if (index >= 0) {
                return this.buffer[(this.start + index) % this.max];
            } else {
                return this.buffer[(this.start + this.length + index) % this.max];
            }
        }

        /**
         * Remove everything from the buffer.
         */
        clear() {
            this.start = 0;
            this.end = 0;
        }
    }
    
    return CircularBuffer;
});
