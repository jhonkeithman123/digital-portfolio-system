export const localStorageRemove = ({ keys }) => {
    keys.forEach((key) => {
        localStorage.removeItem(key);
    });
}

export const localStorageSet = ({ keys, values }) => {
    keys.forEach((key, index) => {
        localStorage.setItem(key, values[index]);
    });
}

export const localStorageGet = ({ keys }) => {
    return keys.map((key) => {
        return localStorage.getItem(key);
    });
}