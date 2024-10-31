#include<stdio.h>
int main()
{
    int size;
    printf("Enter size of array: ");
    scanf("%d", &size);

    int i, j, temp, arr[size];

    printf("Enter elements of array: ");
    for(i = 0; i < size; i++) {
        scanf("%d", &arr[i]);
    }

    // Printing unsorted array
    printf("Unsorted array: ");
    for(i = 0; i < size; i++) {
        printf("%d ", arr[i]);
    }

    // Bubble sort algorithm
    for(i = 0; i < size - 1; i++) {
        for(j = i + 1; j < size; j++) {
            if(arr[i] > arr[j]) {
                temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }
        }
    }

    // Printing sorted array
    printf("\nSorted array: ");
    for(i = 0; i < size; i++) {
        printf("%d ", arr[i]);
    }

    return 0;
}
