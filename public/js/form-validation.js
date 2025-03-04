// Input validation functions
function sanitizeInput(input, allowedPattern) {
    return input.replace(new RegExp(`[^${allowedPattern}]`, 'g'), '');
}

// Show error message for an input field
function showError(input, message) {
    const errorDiv = input.parentElement.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        input.classList.add('input-error');
        input.classList.remove('input-success');
    }
}

// Show success state for an input field
function showSuccess(input) {
    const errorDiv = input.parentElement.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        input.classList.remove('input-error');
        input.classList.add('input-success');
    }
}

// Validation patterns for different fields
const validationPatterns = {
    serialNumber: '^[A-Za-z0-9-]+$',
    modelName: '^[A-Za-z0-9\\s-]+$',
    manufacturer: '^[A-Za-z0-9\\s-]+$',
    newTagNumber: '^[A-Za-z0-9\\s-]+$',
    oldTagNumber: '^[A-Za-z0-9\\s-]+$',
    username: '^[A-Za-z0-9\\s.-]+$',
    supplier: '^[A-Za-z0-9\\s-]+$',
    invoiceNumber: '^[A-Za-z0-9-]+$',
    formerUser: '^[A-Za-z0-9\\s.-]+$',
    location: '^[A-Za-z0-9\\s,.-]+$'
};

// Check for duplicate serial number
async function checkDuplicateSerial(serialNumber) {
    try {
        const response = await fetch(`/check-serial/${serialNumber}`);
        const data = await response.json();
        return data.exists;
    } catch (error) {
        console.error('Error checking serial number:', error);
        return false;
    }
}

// Initialize form validation
function initFormValidation() {
    const form = document.getElementById('addMachineForm');
    const serialInput = document.getElementById('serialNumber');
    const submitButton = form.querySelector('button[type="submit"]');

    // Add validation for each input field
    Object.keys(validationPatterns).forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', function() {
                const sanitized = sanitizeInput(this.value, validationPatterns[fieldId]);
                if (this.value !== sanitized) {
                    this.value = sanitized;
                    showError(this, 'Invalid characters removed');
                } else if (this.value.trim() === '') {
                    showError(this, 'This field is required');
                } else {
                    showSuccess(this);
                }
            });
        }
    });

    // Check for duplicate serial number
    let serialCheckTimeout;
    serialInput.addEventListener('input', function() {
        clearTimeout(serialCheckTimeout);
        const serialNumber = this.value;
        
        serialCheckTimeout = setTimeout(async () => {
            if (serialNumber) {
                const isDuplicate = await checkDuplicateSerial(serialNumber);
                if (isDuplicate) {
                    showError(this, 'This serial number already exists');
                    submitButton.disabled = true;
                } else {
                    showSuccess(this);
                    submitButton.disabled = false;
                }
            }
        }, 500);
    });

    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate all fields
        let isValid = true;
        Object.keys(validationPatterns).forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                if (input.required && !input.value.trim()) {
                    isValid = false;
                    showError(input, 'This field is required');
                } else if (input.value) {
                    const pattern = new RegExp(validationPatterns[fieldId]);
                    if (!pattern.test(input.value)) {
                        isValid = false;
                        showError(input, 'Invalid characters in input');
                    } else {
                        showSuccess(input);
                    }
                }
            }
        });

        // Check for duplicate serial before submission
        const serialNumber = serialInput.value;
        if (serialNumber) {
            const isDuplicate = await checkDuplicateSerial(serialNumber);
            if (isDuplicate) {
                showError(serialInput, 'This serial number already exists');
                isValid = false;
            }
        }

        if (isValid) {
            try {
                this.submit();
            } catch (error) {
                console.error('Form submission error:', error);
                alert('An error occurred while submitting the form. Please try again.');
            }
        }
    });
} 