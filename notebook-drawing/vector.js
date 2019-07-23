define([], function() {
    /**
     * A 2d vector, represents a point on the screen.
     */
    class Vector2 {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
        
        /**
         * Euclidean/2-norm length of the vector.
         */
        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }
        
        /**
         * Get the euclidean distance to another vector.
         * @param other Other vector.
         */
        dist(other) {
            return this.subtract(other).length();
        }
        
        /**
         * Performs vector addition.
         * @param other If a scalar, will add uniformly.  If a vector, will add element-wise.
         * @returns A new vector that is the result of the operation.
         */
        add(other) {
            if (other instanceof Vector2) {
                return new Vector2(this.x + other.x, this.y + other.y);
            } else {
                return new Vector2(this.x + other, this.y + other);
            }
        }

        /**
         * Performs vector subtraction.
         * @param other If a scalar, will subtract both elements.  If vector, will do element-wise.
         * @returns A new vector that is the result of the operation.
         */
        subtract(other) {
            if (other instanceof Vector2) {
                return new Vector2(this.x - other.x, this.y - other.y);
            } else {
                return new Vector2(this.x - other, this.y - other);
            }
        }

        /**
         * Performs vector multiplication.
         * @param other If a scalar, will multiply both elements.  If vector, will do element-wise.
         * @returns A new vector that is the result of the operation.
         */
        multiply(other) {
            if (other instanceof Vector2) {
                return new Vector2(this.x * other.x, this.y * other.y);
            } else {
                return new Vector2(this.x * other, this.y * other);
            }
        }

        /**
         * Performs vector division.
         * @param other If a scalar, will divide both elements.  If vector, will do element-wise.
         * @returns A new vector that is the result of the operation.
         */
        divide(other) {
            if (other instanceof Vector2) {
                return new Vector2(this.x / other.x, this.y / other.y);
            } else {
                return new Vector2(this.x / other, this.y / other);
            }
        }

        /**
         * Linearly interpolate between this vector and another.
         * @param amt coefficient of interpolation, value between 0 and 1.
         * @param other ending vector to interpolate
         * @returns a new vector that is linearly interpolated between the two.
         */
        lerp(amt, other) {
            return this.add(other.subtract(this).multiply(amt));
        }

        /**
         * Find the mid-point between this vector and another.
         * @param other vector
         * @returns new vector that is the midpoint.
         */
        mid(other) {
            return this.add(other).multiply(0.5);
        }
    }

    return Vector2;
});
