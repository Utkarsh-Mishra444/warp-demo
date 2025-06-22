Of course. Here is the mathematical description of the basic axis-aligned rectangular strip warp, formatted in Markdown. This is designed to be a clear and self-contained algorithmic specification that you can provide to an LLM for implementation.

Algorithm: Axis-Aligned Rectangular Strip Warp

This algorithm describes a geometric transformation that warps a rectangular domain based on a 2D attention map. The goal is to magnify regions with high attention and compress regions with low attention, while preserving the alignment of horizontal and vertical grid lines.

The process involves transforming the attention map into a pair of 1D Cumulative Distribution Functions (CDFs) along the x and y axes, and then using these CDFs to create a new coordinate mapping.

Inputs:

A: A 2D array (matrix) of non-negative attention scores, of size H rows by W columns. Let its values be A_ij where i is the column index (0 to W-1) and j is the row index (0 to H-1).

I: An input image (or feature map) of the same size, H x W.

Output:

I_warped: A new H x W image, which is the result of applying the warp to the input image I.

Algorithm Steps (Discrete Implementation for a Pixel Grid):

Normalize Attention Weights:

First, calculate the total sum of all attention scores: total_A = Σ_i Σ_j A_ij.

If total_A is zero, treat all weights as uniform (e.g., a_ij = 1 / (W*H)).

Otherwise, create a normalized attention matrix a where each element is a_ij = A_ij / total_A. This matrix a now represents a discrete probability distribution.

Compute Marginal Probabilities:

Integrate (sum) the probabilities along each axis to get 1D marginal probability distributions (also known as Probability Mass Functions or PMFs).

X-marginal (p): A 1D array of size W. For each column i, p_i = Σ_{j=0}^{H-1} a_ij. This is the total probability mass in column i.

Y-marginal (q): A 1D array of size H. For each row j, q_j = Σ_{i=0}^{W-1} a_ij. This is the total probability mass in row j.

(Note: Σ p_i should be 1, and Σ q_j should be 1).

Compute Cumulative Distributions (CDFs):

Convert the marginal PMFs into Cumulative Distribution Functions (CDFs) by computing their cumulative sum.

X-CDF (P): A 1D array of size W. P_i = Σ_{k=0}^{i} p_k.

Y-CDF (Q): A 1D array of size H. Q_j = Σ_{k=0}^{j} q_k.

(Note: P_{W-1} and Q_{H-1} will be approximately 1.0).

Create the Warped Image via Inverse Mapping and Resampling:

This is the most critical step. We cannot simply move pixels from the old image to the new one, as this creates holes and overlaps. Instead, we iterate through the grid of the new (output) image and determine which pixel from the old (input) image should go there.

Create a new, empty output image I_warped of size H x W.

For each pixel coordinate (x_new, y_new) in the output image I_warped (from (0,0) to (W-1, H-1)):
a. Normalize target coordinates: Convert the target pixel coordinates to a [0, 1] scale.

u = x_new / (W-1)

v = y_new / (H-1)

b. Invert the CDFs: Find the original source coordinates (x_src, y_src) in the [0, 1] range by finding where u and v fall in the CDFs P and Q. This is the inverse of the transformation X = W * P(x).

Find index i such that P_i ≈ u. This can be done by searching the array P. The fractional source x-coordinate is then x_src = i / (W-1).

Find index j such that Q_j ≈ v. This can be done by searching the array Q. The fractional source y-coordinate is then y_src = j / (H-1).

Implementation Note: Since P and Q are monotonic, you can use binary search for efficiency or interpolation to get a more precise fractional index. For example, if P[i-1] < u < P[i], the fractional index is i-1 + (u - P[i-1]) / (P[i] - P[i-1]).

c. Un-normalize source coordinates: Convert the fractional source coordinates (x_src, y_src) back to pixel coordinates.

x_source_pixel = x_src * (W-1)

y_source_pixel = y_src * (H-1)

d. Sample from Input Image: The source coordinates (x_source_pixel, y_source_pixel) are likely not integers. Use an interpolation method (e.g., bilinear interpolation) on the input image I at these coordinates to get the pixel value.

e. Assign to Output: Set the pixel value of I_warped at (x_new, y_new) to the interpolated value.