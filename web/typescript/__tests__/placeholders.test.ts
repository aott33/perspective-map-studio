import { ItemView, fill, isAssetRelative } from '../placeholders';

// The same vectors as common/src/test/.../PlaceholdersTest.java.
const P12: ItemView = {
    itemId: '4f6c', itemName: 'P12', assetId: 'P12', assetPath: '[default]Mesa/P12',
    properties: { operator: 'Acme', wells: 12, note: null }
};
const NO_ASSET: ItemView = { itemId: '9a1b', itemName: 'Line 3', assetId: null, assetPath: null, properties: {} };

describe('fill', () => {
    test('resolves the asset path and every placeholder', () => {
        expect(fill('{asset.path}/Pressure', P12)).toBe('[default]Mesa/P12/Pressure');
        expect(fill('{asset.path}', P12)).toBe('[default]Mesa/P12');
        expect(fill('/pad/{item.name}', P12)).toBe('/pad/P12');
        expect(fill('{item.id} {item.name} {asset.id} {item.properties.operator} {item.properties.wells}', P12))
            .toBe('4f6c P12 P12 Acme 12');
        expect(fill('Mesa', P12)).toBe('Mesa');
    });

    test('numbers fill as String(n), the same vectors as PlaceholdersTest.java', () => {
        const numbers: ItemView = {
            itemId: '4f6c', itemName: 'P12', assetId: null, assetPath: null,
            properties: JSON.parse('{"n0":12.0,"n1":4.50,"n2":1e3,"n3":1e21,"n4":1e-7,"n5":0.000001,'
                + '"n6":-0.5,"n7":0.1,"n8":123456789012345680000,"n9":1.5e300,"n10":0.30000000000000004,"n11":-0,"n12":1e999}')
        };
        expect(fill('{item.properties.n0}', numbers)).toBe('12');
        expect(fill('{item.properties.n1}', numbers)).toBe('4.5');
        expect(fill('{item.properties.n2}', numbers)).toBe('1000');
        expect(fill('{item.properties.n3}', numbers)).toBe('1e+21');
        expect(fill('{item.properties.n4}', numbers)).toBe('1e-7');
        expect(fill('{item.properties.n5}', numbers)).toBe('0.000001');
        expect(fill('{item.properties.n6}', numbers)).toBe('-0.5');
        expect(fill('{item.properties.n7}', numbers)).toBe('0.1');
        expect(fill('{item.properties.n8}', numbers)).toBe('123456789012345680000');
        expect(fill('{item.properties.n9}', numbers)).toBe('1.5e+300');
        expect(fill('{item.properties.n10}', numbers)).toBe('0.30000000000000004');
        expect(fill('{item.properties.n11}', numbers)).toBe('0');
        expect(fill('{item.properties.n12}', numbers)).toBeNull();
    });

    test('a placeholder with no value gives null', () => {
        expect(fill('{asset.path}/Pressure', NO_ASSET)).toBeNull();
        expect(fill('{asset.id}', NO_ASSET)).toBeNull();
        expect(fill('{item.properties.note}', P12)).toBeNull();
        expect(fill('{item.properties.missing}', P12)).toBeNull();
        expect(fill('{item.foo}', P12)).toBeNull();
        expect(fill('{item.name', P12)).toBeNull();
        expect(fill(null, P12)).toBeNull();
    });
});

describe('isAssetRelative', () => {
    test('is {asset.path}/ and a tag path', () => {
        expect(isAssetRelative('{asset.path}/Comms')).toBe(true);
        expect(isAssetRelative('{asset.path}')).toBe(false);
        expect(isAssetRelative('{asset.path}/')).toBe(false);
        expect(isAssetRelative('{asset.path}/{item.name}')).toBe(false);
        expect(isAssetRelative('[default]Shared/GasPrice')).toBe(false);
    });
});
